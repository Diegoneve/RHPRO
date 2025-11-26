import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import {
  exchangeCodeForSessionToken as exchangeCode,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import OpenAI from "openai";

const app = new Hono<{ Bindings: Env }>();

// OAuth endpoints
app.get('/api/oauth/google/redirect_url', async (c) => {
  const redirectUrl = await getOAuthRedirectUrl('google', {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCode(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60,
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  // Check if user has a profile
  const profile = await c.env.DB.prepare(
    `SELECT up.*, d.name as department_name FROM user_profiles up 
     LEFT JOIN departments d ON up.department_id = d.id 
     WHERE up.mocha_user_id = ?`
  ).bind(user.id).first();

  // Check if this is the first user (should be admin)
  const userCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM user_profiles`
  ).first();

  const isFirstUser = userCount?.count === 0;

  return c.json({ user, profile, isFirstUser });
});

app.get('/api/logout', async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === 'string') {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'none',
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// User Profile endpoints
app.post("/api/profiles", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const body = await c.req.json();

  const { name, role, department_id, manager_id, position_id } = body;

  if (!name || !role || !department_id) {
    return c.json({ error: "Name, role and department are required" }, 400);
  }

  // Check if this is the first user
  const userCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM user_profiles`
  ).first();

  const finalRole = userCount?.count === 0 ? "c-level" : role;

  // Get position name if position_id is provided
  let positionName = null;
  if (position_id) {
    const position = await c.env.DB.prepare(
      `SELECT name FROM positions WHERE id = ?`
    ).bind(position_id).first();
    positionName = position?.name || null;
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO user_profiles (mocha_user_id, name, role, position, department_id, manager_id, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(user.id, name, finalRole, positionName, department_id, manager_id || null).run();

  if (!result.success) {
    return c.json({ error: "Failed to create profile" }, 500);
  }

  return c.json({ success: true, id: result.meta.last_row_id }, 201);
});

app.get("/api/profiles", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT up.*, d.name as department_name 
     FROM user_profiles up 
     LEFT JOIN departments d ON up.department_id = d.id 
     ORDER BY up.name ASC`
  ).all();

  return c.json(results);
});

// Admin endpoints for user management
app.get("/api/admin/users", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT up.*, d.name as department_name, m.name as manager_name
     FROM user_profiles up 
     LEFT JOIN departments d ON up.department_id = d.id 
     LEFT JOIN user_profiles m ON up.manager_id = m.id
     ORDER BY up.created_at DESC`
  ).all();

  return c.json(results);
});

app.post("/api/admin/users", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const { name, role, position, department_id, manager_id } = body;

  if (!name || !role || !department_id) {
    return c.json({ error: "Name, role and department are required" }, 400);
  }

  // Generate sequential mocha_user_id
  const maxUser = await c.env.DB.prepare(
    `SELECT MAX(CAST(SUBSTR(mocha_user_id, 4) AS INTEGER)) as max_num 
     FROM user_profiles 
     WHERE mocha_user_id LIKE 'USR%'`
  ).first();

  const nextNum = ((maxUser?.max_num as number) || 0) + 1;
  const mocha_user_id = `USR${String(nextNum).padStart(4, '0')}`;

  const result = await c.env.DB.prepare(
    `INSERT INTO user_profiles (mocha_user_id, name, role, position, department_id, manager_id, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(mocha_user_id, name, role, position || null, department_id, manager_id || null).run();

  if (!result.success) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  return c.json({ success: true, id: result.meta.last_row_id }, 201);
});

app.put("/api/admin/users/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const userId = c.req.param("id");
  const body = await c.req.json();
  const { name, role, position, department_id, manager_id } = body;

  await c.env.DB.prepare(
    `UPDATE user_profiles 
     SET name = ?, role = ?, position = ?, department_id = ?, manager_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(name, role, position || null, department_id, manager_id || null, userId).run();

  return c.json({ success: true });
});

// Department endpoints
app.get("/api/departments", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT d.*, m.name as manager_name 
     FROM departments d 
     LEFT JOIN user_profiles m ON d.manager_id = m.id 
     ORDER BY d.name ASC`
  ).all();

  return c.json(results);
});

app.post("/api/departments", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const { code, name, manager_id, phone } = body;

  if (!code || !name) {
    return c.json({ error: "Code and name are required" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO departments (code, name, manager_id, phone, updated_at) 
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(code, name, manager_id || null, phone || null).run();

  if (!result.success) {
    return c.json({ error: "Failed to create department" }, 500);
  }

  return c.json({ success: true, id: result.meta.last_row_id }, 201);
});

app.put("/api/departments/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const departmentId = c.req.param("id");
  const body = await c.req.json();
  const { code, name, manager_id, phone } = body;

  await c.env.DB.prepare(
    `UPDATE departments 
     SET code = ?, name = ?, manager_id = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(code, name, manager_id || null, phone || null, departmentId).run();

  return c.json({ success: true });
});

// Helper function to log task changes
async function logTaskChange(db: any, taskId: number, userId: number, fieldName: string, oldValue: any, newValue: any) {
  await db.prepare(
    `INSERT INTO task_change_log (task_id, user_id, field_name, old_value, new_value)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(taskId, userId, fieldName, oldValue ? String(oldValue) : null, newValue ? String(newValue) : null).run();
}

// Task endpoints
app.get("/api/tasks", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  // Update overdue tasks to 'nao_entregue' status
  await c.env.DB.prepare(
    `UPDATE tasks 
     SET status = 'nao_entregue', updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('aberta', 'em_andamento')
     AND deadline IS NOT NULL 
     AND DATE(deadline) < DATE('now')`
  ).run();

  // Build query based on user role
  let query = `
    SELECT t.*, 
           a.name as assignee_name,
           c.name as creator_name,
           p.name as project_name
    FROM tasks t
    LEFT JOIN user_profiles a ON t.assignee_id = a.id
    LEFT JOIN user_profiles c ON t.creator_id = c.id
    LEFT JOIN projects p ON t.sprint_id = p.id
  `;

  let whereClause = "";
  let bindings: any[] = [];

  switch (profile.role) {
    case "c-level":
      // C-Level sees all tasks
      whereClause = "";
      break;

    case "gerencia":
      // Gerência sees all tasks from their department
      whereClause = `WHERE (
        a.department_id = ? OR 
        c.department_id = ? OR
        t.assignee_id = ? OR 
        t.creator_id = ?
      )`;
      bindings = [profile.department_id, profile.department_id, profile.id, profile.id];
      break;

    case "coordenacao":
    case "supervisao":
      // Coordenação and Supervisão see their own tasks + their team's tasks (all statuses)
      const { results: teamMembers } = await c.env.DB.prepare(
        `SELECT id FROM user_profiles WHERE manager_id = ?`
      ).bind(profile.id).all();
      
      const teamIds = teamMembers.map((m: any) => m.id);
      teamIds.push(profile.id);
      
      const placeholders = teamIds.map(() => '?').join(',');
      whereClause = `WHERE (t.assignee_id IN (${placeholders}) OR t.creator_id IN (${placeholders}))`;
      bindings = [...teamIds, ...teamIds];
      break;

    case "analista":
    case "assistente":
    case "auxiliar":
      // Analista, Assistente, Auxiliar see their own tasks + their team's open tasks
      const { results: teamMembersOperational } = await c.env.DB.prepare(
        `SELECT id FROM user_profiles WHERE manager_id = (SELECT manager_id FROM user_profiles WHERE id = ?)`
      ).bind(profile.id).all();
      
      const teamIdsOperational = teamMembersOperational.map((m: any) => m.id);
      teamIdsOperational.push(profile.id);
      
      const placeholdersOperational = teamIdsOperational.map(() => '?').join(',');
      whereClause = `WHERE (
        t.assignee_id = ? OR 
        t.creator_id = ? OR
        (t.assignee_id IN (${placeholdersOperational}) AND t.status = 'aberta')
      )`;
      bindings = [profile.id, profile.id, ...teamIdsOperational];
      break;

    case "estagiario":
      // Estagiário sees only their own tasks
      whereClause = `WHERE (t.assignee_id = ? OR t.creator_id = ?)`;
      bindings = [profile.id, profile.id];
      break;

    default:
      whereClause = `WHERE (t.assignee_id = ? OR t.creator_id = ?)`;
      bindings = [profile.id, profile.id];
  }

  query += whereClause + ` ORDER BY t.deadline ASC, t.created_at DESC`;

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

  return c.json(results);
});

app.post("/api/tasks", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const body = await c.req.json();

  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const { title, description, deadline, assignee_id, importance, notes, project_id } = body;

  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO tasks (title, description, status, deadline, assignee_id, creator_id, importance, notes, sprint_id, updated_at)
     VALUES (?, ?, 'aberta', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(title, description || null, deadline || null, assignee_id || null, profile.id, importance || 'media', notes || null, project_id || null).run();

  if (!result.success) {
    return c.json({ error: "Failed to create task" }, 500);
  }

  const taskId = Number(result.meta.last_row_id);

  // Log task creation
  await logTaskChange(c.env.DB, taskId, Number(profile.id), 'created', null, 'Task created');

  return c.json({ success: true, id: taskId }, 201);
});

app.put("/api/tasks/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const taskId = c.req.param("id");
  const body = await c.req.json();

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const task = await c.env.DB.prepare(
    `SELECT * FROM tasks WHERE id = ?`
  ).bind(taskId).first();

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const { status, comment, title, description, assignee_id, deadline, importance, notes } = body;

  // Validate status change
  if (status === "em_andamento" && !task.assignee_id && !assignee_id) {
    return c.json({ error: "Não é possível iniciar uma tarefa sem responsável atribuído" }, 400);
  }

  // Track what changed
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  if (status && status !== task.status) {
    changes.push({ field: 'status', oldValue: task.status, newValue: status });
  }

  if (title !== undefined && title !== task.title) {
    changes.push({ field: 'title', oldValue: task.title, newValue: title });
  }

  if (description !== undefined && description !== task.description) {
    changes.push({ field: 'description', oldValue: task.description, newValue: description });
  }

  if (assignee_id !== undefined && assignee_id !== task.assignee_id) {
    changes.push({ field: 'assignee_id', oldValue: task.assignee_id, newValue: assignee_id });
  }

  if (deadline !== undefined && deadline !== task.deadline) {
    changes.push({ field: 'deadline', oldValue: task.deadline, newValue: deadline });
  }

  if (importance !== undefined && importance !== task.importance) {
    changes.push({ field: 'importance', oldValue: task.importance, newValue: importance });
  }

  if (notes !== undefined && notes !== task.notes) {
    changes.push({ field: 'notes', oldValue: task.notes, newValue: notes });
  }

  // Update task status
  const oldStatus = task.status;
  const finalStatus = status || task.status;

  await c.env.DB.prepare(
    `UPDATE tasks 
     SET status = ?, 
         completed_at = CASE WHEN ? = 'concluida' THEN CURRENT_TIMESTAMP ELSE completed_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(finalStatus, finalStatus, taskId).run();

  // Log all changes
  for (const change of changes) {
    await logTaskChange(c.env.DB, parseInt(taskId), Number(profile.id), change.field, change.oldValue, change.newValue);
  }

  // Record update comment
  if (comment) {
    await c.env.DB.prepare(
      `INSERT INTO task_updates (task_id, user_id, comment, status_before, status_after)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(taskId, profile.id, comment, oldStatus, finalStatus).run();
  }

  return c.json({ success: true });
});

app.get("/api/tasks/:id/updates", authMiddleware, async (c) => {
  const taskId = c.req.param("id");

  const { results: updates } = await c.env.DB.prepare(
    `SELECT tu.*, up.name as user_name
     FROM task_updates tu
     LEFT JOIN user_profiles up ON tu.user_id = up.id
     WHERE tu.task_id = ?
     ORDER BY tu.created_at DESC`
  ).bind(taskId).all();

  // Get attachments for each update
  const updatesWithAttachments = await Promise.all(
    updates.map(async (update: any) => {
      const { results: attachments } = await c.env.DB.prepare(
        `SELECT * FROM task_attachments WHERE task_update_id = ?`
      ).bind(update.id).all();
      
      return {
        ...update,
        attachments: attachments || [],
      };
    })
  );

  return c.json(updatesWithAttachments);
});

// Upload attachment endpoint
app.post("/api/tasks/:id/attachments", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const taskId = c.req.param("id");
  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const updateId = formData.get("update_id") as string;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!updateId) {
    return c.json({ error: "Update ID required" }, 400);
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    return c.json({ error: "Só é possível subir documentos até 10MB de tamanho" }, 400);
  }

  // Generate unique key for R2
  const timestamp = Date.now();
  const r2Key = `task-attachments/${taskId}/${updateId}/${timestamp}-${file.name}`;

  try {
    // Upload to R2
    await c.env.R2_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Save metadata to database
    const result = await c.env.DB.prepare(
      `INSERT INTO task_attachments (task_update_id, filename, file_size, content_type, r2_key, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(updateId, file.name, file.size, file.type, r2Key).run();

    if (!result.success) {
      return c.json({ error: "Failed to save attachment metadata" }, 500);
    }

    return c.json({ 
      success: true, 
      id: result.meta.last_row_id,
      filename: file.name,
      file_size: file.size,
    }, 201);
  } catch (error) {
    console.error("Failed to upload attachment:", error);
    return c.json({ error: "Failed to upload attachment" }, 500);
  }
});

// Download attachment endpoint
app.get("/api/attachments/:id", authMiddleware, async (c) => {
  const attachmentId = c.req.param("id");

  const attachment = await c.env.DB.prepare(
    `SELECT * FROM task_attachments WHERE id = ?`
  ).bind(attachmentId).first();

  if (!attachment) {
    return c.json({ error: "Attachment not found" }, 404);
  }

  try {
    const object = await c.env.R2_BUCKET.get(attachment.r2_key as string);
    
    if (!object) {
      return c.json({ error: "File not found in storage" }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Content-Disposition", `attachment; filename="${attachment.filename}"`);

    return c.body(object.body, { headers });
  } catch (error) {
    console.error("Failed to download attachment:", error);
    return c.json({ error: "Failed to download attachment" }, 500);
  }
});

// Project endpoints (formerly Sprint endpoints)
app.get("/api/projects", authMiddleware, async (c) => {
  const { results: projects } = await c.env.DB.prepare(
    `SELECT * FROM projects ORDER BY created_at DESC`
  ).all();

  // Get task stats for each project
  const projectsWithStats = await Promise.all(
    projects.map(async (project: any) => {
      const stats = await c.env.DB.prepare(
        `SELECT 
           COUNT(*) as total_tasks,
           SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_tasks,
           SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as in_progress_tasks,
           SUM(CASE WHEN status = 'aberta' THEN 1 ELSE 0 END) as open_tasks,
           SUM(CASE WHEN status = 'nao_entregue' THEN 1 ELSE 0 END) as not_delivered_tasks
         FROM tasks
         WHERE sprint_id = ?`
      ).bind(project.id).first();

      return {
        ...project,
        total_tasks: stats?.total_tasks || 0,
        completed_tasks: stats?.completed_tasks || 0,
        in_progress_tasks: stats?.in_progress_tasks || 0,
        open_tasks: stats?.open_tasks || 0,
        not_delivered_tasks: stats?.not_delivered_tasks || 0,
      };
    })
  );

  return c.json(projectsWithStats);
});

app.get("/api/projects/active", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM projects WHERE status = 'em_andamento' ORDER BY created_at DESC`
  ).all();

  return c.json(results);
});

app.get("/api/projects/active-list", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM projects WHERE status = 'em_andamento' ORDER BY created_at DESC`
  ).all();

  return c.json(results);
});

app.get("/api/projects/user", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  // Get projects where user has tasks assigned
  const { results: projects } = await c.env.DB.prepare(
    `SELECT DISTINCT p.* 
     FROM projects p
     INNER JOIN tasks t ON p.id = t.sprint_id
     WHERE t.assignee_id = ?
     ORDER BY p.created_at DESC`
  ).bind(profile.id).all();

  // Get task stats for each project
  const projectsWithStats = await Promise.all(
    projects.map(async (project: any) => {
      const stats = await c.env.DB.prepare(
        `SELECT 
           COUNT(*) as total_tasks,
           SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_tasks,
           SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as in_progress_tasks,
           SUM(CASE WHEN status = 'aberta' THEN 1 ELSE 0 END) as open_tasks,
           SUM(CASE WHEN status = 'nao_entregue' THEN 1 ELSE 0 END) as not_delivered_tasks
         FROM tasks
         WHERE sprint_id = ? AND assignee_id = ?`
      ).bind(project.id, profile.id).first();

      return {
        ...project,
        total_tasks: stats?.total_tasks || 0,
        completed_tasks: stats?.completed_tasks || 0,
        in_progress_tasks: stats?.in_progress_tasks || 0,
        open_tasks: stats?.open_tasks || 0,
        not_delivered_tasks: stats?.not_delivered_tasks || 0,
      };
    })
  );

  return c.json(projectsWithStats);
});

app.post("/api/projects", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const { name, start_date, end_date, status } = body;

  if (!name || !start_date || !end_date) {
    return c.json({ error: "Name, start date and end date are required" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO projects (name, start_date, end_date, status, updated_at) 
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(name, start_date, end_date, status || 'em_andamento').run();

  if (!result.success) {
    return c.json({ error: "Failed to create project" }, 500);
  }

  return c.json({ success: true, id: result.meta.last_row_id }, 201);
});

app.put("/api/projects/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const projectId = c.req.param("id");
  const body = await c.req.json();
  const { name, start_date, end_date, status } = body;

  await c.env.DB.prepare(
    `UPDATE projects 
     SET name = ?, start_date = ?, end_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(name, start_date, end_date, status, projectId).run();

  return c.json({ success: true });
});

app.get("/api/projects/:id/tasks", authMiddleware, async (c) => {
  const projectId = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    `SELECT t.*, 
            a.name as assignee_name,
            c.name as creator_name
     FROM tasks t
     LEFT JOIN user_profiles a ON t.assignee_id = a.id
     LEFT JOIN user_profiles c ON t.creator_id = c.id
     WHERE t.sprint_id = ?
     ORDER BY t.deadline ASC, t.created_at DESC`
  ).bind(projectId).all();

  return c.json(results);
});

// Position endpoints
app.get("/api/positions", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM positions ORDER BY role ASC, name ASC`
  ).all();

  return c.json(results);
});

app.get("/api/positions/by-role/:role", authMiddleware, async (c) => {
  const role = c.req.param("role");
  
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM positions WHERE role = ? AND is_active = 1 ORDER BY name ASC`
  ).bind(role).all();

  return c.json(results);
});

app.post("/api/positions", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const { name, role, is_active } = body;

  if (!name || !role) {
    return c.json({ error: "Name and role are required" }, 400);
  }

  // Check if position name already exists for this role
  const existing = await c.env.DB.prepare(
    `SELECT id FROM positions WHERE name = ? AND role = ?`
  ).bind(name, role).first();

  if (existing) {
    return c.json({ error: "Já existe um cargo com este nome para este nível" }, 400);
  }

  // Generate code automatically - get max ID and increment
  const maxCode = await c.env.DB.prepare(
    `SELECT MAX(CAST(SUBSTR(code, 4) AS INTEGER)) as max_num FROM positions WHERE code LIKE 'CRG%'`
  ).first();

  const nextNum = ((maxCode?.max_num as number) || 0) + 1;
  const code = `CRG${String(nextNum).padStart(4, '0')}`;

  const result = await c.env.DB.prepare(
    `INSERT INTO positions (code, name, role, is_active, updated_at) 
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(code, name, role, is_active ? 1 : 0).run();

  if (!result.success) {
    return c.json({ error: "Failed to create position" }, 500);
  }

  return c.json({ success: true, id: result.meta.last_row_id, code }, 201);
});

app.put("/api/positions/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile || (profile.role !== "c-level" && profile.role !== "gerencia")) {
    return c.json({ error: "Access denied" }, 403);
  }

  const positionId = c.req.param("id");
  const body = await c.req.json();
  const { name, role, is_active } = body;

  // Check if position name already exists for this role (excluding current)
  const existing = await c.env.DB.prepare(
    `SELECT id FROM positions WHERE name = ? AND role = ? AND id != ?`
  ).bind(name, role, positionId).first();

  if (existing) {
    return c.json({ error: "Já existe um cargo com este nome para este nível" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE positions 
     SET name = ?, role = ?, is_active = ?, 
         inactivated_at = CASE WHEN ? = 0 AND is_active = 1 THEN CURRENT_TIMESTAMP ELSE inactivated_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(name, role, is_active ? 1 : 0, is_active ? 1 : 0, positionId).run();

  return c.json({ success: true });
});

// Dashboard/Analytics endpoints
app.get("/api/analytics/team", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  // Get team members (direct reports)
  const { results: teamMembers } = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE manager_id = ?`
  ).bind(profile.id).all();

  const teamIds = teamMembers.map((m: any) => m.id);
  
  if (teamIds.length === 0) {
    return c.json({ team: [], stats: [] });
  }

  // Get task stats for each team member
  const placeholders = teamIds.map(() => '?').join(',');
  const { results: stats } = await c.env.DB.prepare(
    `SELECT 
       assignee_id,
       COUNT(*) as total_tasks,
       SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed_tasks,
       SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as in_progress_tasks,
       SUM(CASE WHEN status = 'aberta' THEN 1 ELSE 0 END) as open_tasks,
       SUM(CASE WHEN deadline < DATE('now') AND status != 'concluida' THEN 1 ELSE 0 END) as overdue_tasks
     FROM tasks
     WHERE assignee_id IN (${placeholders})
     GROUP BY assignee_id`
  ).bind(...teamIds).all();

  return c.json({ team: teamMembers, stats });
});

// AI Assistant endpoints
app.get("/api/assistant/messages", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT role, content, created_at FROM assistant_messages 
     WHERE user_id = ? 
     ORDER BY created_at ASC`
  ).bind(profile.id).all();

  return c.json(results);
});

app.get("/api/assistant/check-overdue-tasks", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  try {
    // Check if an alert was already sent today
    const today = new Date().toISOString().split('T')[0];
    const lastAlert = await c.env.DB.prepare(
      `SELECT created_at FROM assistant_messages 
       WHERE user_id = ? 
       AND role = 'assistant' 
       AND content LIKE '%tarefas atrasadas%'
       AND DATE(created_at) = DATE(?)
       ORDER BY created_at DESC
       LIMIT 1`
    ).bind(profile.id, today).first();

    if (lastAlert) {
      // Alert already sent today
      return c.json({ alert_sent: false, reason: "already_sent_today" });
    }

    // Get overdue tasks for this user
    const { results: overdueTasks } = await c.env.DB.prepare(
      `SELECT t.*, 
              a.name as assignee_name,
              c.name as creator_name,
              p.name as project_name
       FROM tasks t
       LEFT JOIN user_profiles a ON t.assignee_id = a.id
       LEFT JOIN user_profiles c ON t.creator_id = c.id
       LEFT JOIN projects p ON t.sprint_id = p.id
       WHERE (t.assignee_id = ? OR t.creator_id = ?)
       AND t.status IN ('aberta', 'em_andamento', 'nao_entregue')
       AND t.deadline IS NOT NULL
       AND DATE(t.deadline) < DATE('now')
       ORDER BY t.deadline ASC`
    ).bind(profile.id, profile.id).all();

    if (overdueTasks.length === 0) {
      // No overdue tasks
      return c.json({ alert_sent: false, reason: "no_overdue_tasks" });
    }

    // Generate alert message
    const taskList = overdueTasks.map((task: any) => {
      const daysOverdue = Math.ceil((new Date().getTime() - new Date(task.deadline).getTime()) / (1000 * 60 * 60 * 24));
      return `• ${task.title} - Prazo: ${new Date(task.deadline).toLocaleDateString("pt-BR")} (${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} atrasada)${task.project_name ? ` - Projeto: ${task.project_name}` : ''}`;
    }).join('\n');

    const alertMessage = `⚠️ **ALERTA DE TAREFAS ATRASADAS** ⚠️

Olá, ${profile.name}! 

Identifiquei que você tem ${overdueTasks.length} ${overdueTasks.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} que ${overdueTasks.length === 1 ? 'precisa' : 'precisam'} da sua atenção:

${taskList}

🎯 **Recomendações:**
${overdueTasks.length > 3 ? '- Priorize as tarefas mais antigas primeiro\n- Considere renegociar prazos se necessário\n- Atualize o status de cada tarefa para manter a transparência' : '- Foque em concluir essas tarefas o mais rápido possível\n- Atualize o progresso de cada uma\n- Se necessário, solicite suporte da sua equipe'}

Como posso ajudar você a organizar essas tarefas?`;

    // Save alert message to database
    await c.env.DB.prepare(
      `INSERT INTO assistant_messages (user_id, role, content, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(profile.id, "assistant", alertMessage).run();

    return c.json({ 
      alert_sent: true, 
      overdue_count: overdueTasks.length,
      message: alertMessage 
    });
  } catch (error) {
    console.error("Failed to check overdue tasks:", error);
    return c.json({ error: "Failed to check overdue tasks" }, 500);
  }
});

app.post("/api/assistant/chat", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await c.env.DB.prepare(
    `SELECT up.*, d.name as department_name FROM user_profiles up 
     LEFT JOIN departments d ON up.department_id = d.id 
     WHERE up.mocha_user_id = ?`
  ).bind(user.id).first();

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const body = await c.req.json();
  const { messages } = body;

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: "Messages array is required" }, 400);
  }

  // Check if OpenAI API key is configured
  if (!c.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured");
    return c.json({ 
      error: "API key not configured",
      message: "Desculpe, o assistente não está configurado corretamente. Por favor, entre em contato com o administrador."
    }, 500);
  }

  try {
    // Get user's tasks
    const { results: tasks } = await c.env.DB.prepare(
      `SELECT t.*, 
              a.name as assignee_name,
              c.name as creator_name,
              p.name as project_name
       FROM tasks t
       LEFT JOIN user_profiles a ON t.assignee_id = a.id
       LEFT JOIN user_profiles c ON t.creator_id = c.id
       LEFT JOIN projects p ON t.sprint_id = p.id
       WHERE t.assignee_id = ? OR t.creator_id = ?
       ORDER BY t.deadline ASC, t.created_at DESC`
    ).bind(profile.id, profile.id).all();

    // Get user's projects
    const { results: projects } = await c.env.DB.prepare(
      `SELECT DISTINCT p.* 
       FROM projects p
       INNER JOIN tasks t ON p.id = t.sprint_id
       WHERE t.assignee_id = ? OR t.creator_id = ?
       ORDER BY p.created_at DESC`
    ).bind(profile.id, profile.id).all();

    // Prepare context
    const now = new Date();
    const tasksContext = tasks.map((t: any) => {
      const isOverdue = t.deadline && new Date(t.deadline) < now;
      const daysUntilDeadline = t.deadline 
        ? Math.ceil((new Date(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        importance: t.importance,
        deadline: t.deadline,
        isOverdue,
        daysUntilDeadline,
        project: t.project_name,
        assignee: t.assignee_name,
      };
    });

    const systemPrompt = `Você é RHProdutivoFlow, um assistente virtual inteligente especializado em acompanhar tarefas, projetos, sprints e usuários.

IDENTIDADE:
- Nome: RHProdutivoFlow
- Objetivo: Aumentar a produtividade, alertar sobre prazos, organizar prioridades e orientar o usuário
- Personalidade: Amigável, profissional, motivador e proativo

COMPORTAMENTO:
✓ Organize informações (listas, checklists, prioridades)
✓ Classifique urgência das tarefas
✓ Avise quando uma tarefa está perto do prazo ou atrasada
✓ Sugira a próxima melhor ação do usuário
✓ Busque reduzir o estresse e dar clareza
✓ Responda com objetividade e simplicidade
✓ Nunca deixe o usuário sem uma próxima ação recomendada

CLASSIFICAÇÃO DE TAREFAS:
- Importância: Alta, Média, Baixa
- Status: Aberta, Em andamento, Não entregue, Concluída
- Deadline: com data ou sem data

MENSAGENS DE ALERTA:
- "⚠️ Essa tarefa está perto do prazo."
- "⏰ Urgente: prazo expira hoje."
- "🟡 Recomendo fazer essa antes das outras."
- "🟢 Essa pode ser deixada para depois."
- "⏰ Urgente: Essa tarefa já está com prazo vencido."

INFORMAÇÕES DO USUÁRIO:
Nome: ${profile.name}
Cargo: ${profile.position || profile.role}
Departamento: ${profile.department_name || "Não especificado"}

TAREFAS ATUAIS (${tasks.length} tarefas):
${tasksContext.map((t: any) => 
  `- [${t.status}] ${t.title} (Importância: ${t.importance})${t.deadline ? ` - Prazo: ${new Date(t.deadline).toLocaleDateString("pt-BR")}${t.isOverdue ? " (ATRASADO)" : t.daysUntilDeadline !== null && t.daysUntilDeadline <= 2 ? " (URGENTE)" : ""}` : ""}${t.project ? ` - Projeto: ${t.project}` : ""}`
).join("\n")}

PROJETOS ATIVOS (${projects.length} projetos):
${projects.map((p: any) => 
  `- ${p.name} (${new Date(p.start_date).toLocaleDateString("pt-BR")} - ${new Date(p.end_date).toLocaleDateString("pt-BR")})`
).join("\n")}

ESTATÍSTICAS:
- Total de tarefas: ${tasks.length}
- Concluídas: ${tasks.filter((t: any) => t.status === "concluida").length}
- Em andamento: ${tasks.filter((t: any) => t.status === "em_andamento").length}
- Abertas: ${tasks.filter((t: any) => t.status === "aberta").length}
- Não entregues: ${tasks.filter((t: any) => t.status === "nao_entregue").length}
- Atrasadas: ${tasksContext.filter((t: any) => t.isOverdue).length}
- Próximas do prazo (48h): ${tasksContext.filter((t: any) => !t.isOverdue && t.daysUntilDeadline !== null && t.daysUntilDeadline <= 2).length}

INSTRUÇÕES:
1. Sempre analise o contexto das tarefas antes de responder
2. Identifique tarefas urgentes, atrasadas ou próximas do prazo
3. Sugira prioridades baseadas em importância, urgência e prazos
4. Forneça uma visão clara do que precisa ser feito
5. Seja motivador e ajude a reduzir o estresse
6. Use emojis para destacar urgências e prioridades
7. Sempre termine com uma próxima ação recomendada

Responda de forma clara, objetiva e motivadora. Ajude o usuário a conquistar seus objetivos!`;

    const client = new OpenAI({
      apiKey: c.env.OPENAI_API_KEY,
    });

    console.log("Calling OpenAI API...");
    
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    console.log("OpenAI API response received");

    const assistantMessage = completion.choices[0].message.content;

    // Save user message to database
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      await c.env.DB.prepare(
        `INSERT INTO assistant_messages (user_id, role, content, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(profile.id, "user", lastUserMessage.content).run();
    }

    // Save assistant message to database
    if (assistantMessage) {
      await c.env.DB.prepare(
        `INSERT INTO assistant_messages (user_id, role, content, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(profile.id, "assistant", assistantMessage).run();
    }

    return c.json({ message: assistantMessage });
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    console.error("Error details:", error.message, error.status, error.code);
    
    let userMessage = "Desculpe, não consegui processar sua solicitação no momento. Por favor, tente novamente.";
    
    if (error.status === 401) {
      userMessage = "Erro de autenticação com a API do OpenAI. Por favor, verifique a configuração da chave.";
    } else if (error.status === 429) {
      userMessage = "Limite de requisições atingido. Por favor, tente novamente em alguns instantes.";
    } else if (error.code === 'insufficient_quota') {
      userMessage = "Cota da API do OpenAI excedida. Por favor, entre em contato com o administrador.";
    }
    
    return c.json({ 
      error: "Failed to get assistant response",
      message: userMessage,
      details: error.message
    }, 500);
  }
});

export default app;
