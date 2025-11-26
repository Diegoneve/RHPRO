import z from "zod";

export const UserRoleSchema = z.enum([
  'c-level',
  'gerencia',
  'coordenacao',
  'supervisao',
  'analista',
  'assistente',
  'auxiliar',
  'estagiario'
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

export const TaskStatusSchema = z.enum(['aberta', 'em_andamento', 'concluida', 'nao_entregue']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskImportanceSchema = z.enum(['baixa', 'media', 'alta']);

export type TaskImportance = z.infer<typeof TaskImportanceSchema>;

export const UserProfileSchema = z.object({
  id: z.number(),
  mocha_user_id: z.string(),
  name: z.string(),
  role: UserRoleSchema,
  position: z.string().nullable(),
  department_id: z.number().nullable(),
  department_name: z.string().nullable(),
  manager_id: z.number().nullable(),
  manager_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const DepartmentSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  manager_id: z.number().nullable(),
  manager_name: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Department = z.infer<typeof DepartmentSchema>;

export const TaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  deadline: z.string().nullable(),
  assignee_id: z.number().nullable(),
  creator_id: z.number(),
  importance: TaskImportanceSchema,
  notes: z.string().nullable(),
  completed_at: z.string().nullable(),
  project_id: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  assignee_name: z.string().optional(),
  creator_name: z.string().optional(),
  project_name: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskUpdateSchema = z.object({
  id: z.number(),
  task_id: z.number(),
  user_id: z.number(),
  comment: z.string(),
  status_before: z.string().nullable(),
  status_after: z.string().nullable(),
  created_at: z.string(),
  user_name: z.string().optional(),
});

export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;

export const TaskAttachmentSchema = z.object({
  id: z.number(),
  task_update_id: z.number(),
  filename: z.string(),
  file_size: z.number(),
  content_type: z.string(),
  r2_key: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskAttachment = z.infer<typeof TaskAttachmentSchema>;

export const ProjectStatusSchema = z.enum(['em_andamento', 'encerrado']);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  status: ProjectStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const PositionSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  role: UserRoleSchema,
  is_active: z.boolean(),
  inactivated_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;
