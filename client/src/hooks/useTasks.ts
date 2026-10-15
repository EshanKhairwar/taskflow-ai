import { useCallback, useEffect, useState } from "react";
import {
  createTask as createTaskRequest,
  deleteTask as deleteTaskRequest,
  getProjectTasks,
  moveTask as moveTaskRequest,
  updateTask as updateTaskRequest,
} from "../api/tasks.api";
import type { CreateTaskInput, Task, TaskStatus } from "../types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingTaskIds, setMovingTaskIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getProjectTasks(projectId, { limit: 100 });
      setTasks(response.tasks);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = useCallback(async (input: CreateTaskInput) => {
    setSaving(true);
    setError(null);
    try {
      const response = await createTaskRequest(projectId, input);
      setTasks((current) => {
        const next = [...current.filter((task) => task._id !== response.task._id), response.task];
        return next.sort((a, b) => a.status.localeCompare(b.status) || a.position - b.position);
      });
      return response.task;
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  const update = useCallback(async (taskId: string, input: Partial<CreateTaskInput>) => {
    const previous = tasks;
    setSaving(true);
    setError(null);
    try {
      const response = await updateTaskRequest(taskId, input);
      setTasks((current) => current.map((task) => task._id === taskId ? response.task : task));
      return response.task;
    } catch (err) {
      setTasks(previous);
      const message = errorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [tasks]);

  const remove = useCallback(async (taskId: string) => {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task._id !== taskId));
    setError(null);
    try {
      await deleteTaskRequest(taskId);
    } catch (err) {
      setTasks(previous);
      const message = errorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, [tasks]);

  const moveTask = useCallback(async (taskId: string, status: TaskStatus, targetIndex: number) => {
    const previousTasks = tasks;
    const dragged = previousTasks.find((task) => task._id === taskId);
    if (!dragged || movingTaskIds.includes(taskId)) return;

    const targetColumn = previousTasks
      .filter((task) => task.status === status && task._id !== taskId)
      .sort((a, b) => a.position - b.position);
    const boundedIndex = Math.max(0, Math.min(targetIndex, targetColumn.length));
    targetColumn.splice(boundedIndex, 0, { ...dragged, status });
    const changedColumn = previousTasks.filter((task) => task.status !== status && task._id !== taskId);
    const reindexedTarget = targetColumn.map((task, index) => ({ ...task, status, position: index }));
    const optimistic = [...changedColumn, ...reindexedTarget].sort((a, b) => a.status.localeCompare(b.status) || a.position - b.position);

    setTasks(optimistic);
    setError(null);
    setMovingTaskIds((ids) => [...ids, taskId]);
    try {
      await moveTaskRequest(taskId, { status, position: boundedIndex });
      // Refresh after a successful move so the server's canonical positions are used.
      const response = await getProjectTasks(projectId, { limit: 100 });
      setTasks(response.tasks);
    } catch (err) {
      setTasks(previousTasks);
      setError(`Could not move task: ${errorMessage(err)}`);
    } finally {
      setMovingTaskIds((ids) => ids.filter((id) => id !== taskId));
    }
  }, [tasks, movingTaskIds, projectId]);

  return { tasks, loading, error, refresh, create, update, remove, moveTask, movingTaskIds, saving };
}
