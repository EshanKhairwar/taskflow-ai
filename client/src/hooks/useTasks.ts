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

/**
 * MongoDB ObjectIds are 24 hexadecimal characters.
 * This prevents invalid IDs from being sent to task endpoints.
 */
function validateTaskId(taskId: string): string {
  const id = String(taskId ?? "").trim();

  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new Error(
      `Invalid task ID: ${JSON.stringify(taskId)}. Expected a valid MongoDB ObjectId.`,
    );
  }

  return id;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => a.status.localeCompare(b.status) || a.position - b.position,
  );
}

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingTaskIds, setMovingTaskIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch tasks for the current project.
  const refresh = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getProjectTasks(projectId, {
        limit: 100,
      });

      const validTasks = (response.tasks ?? []).filter(
        (task) =>
          typeof task._id === "string" && /^[a-f\d]{24}$/i.test(task._id),
      );

      if (validTasks.length !== (response.tasks ?? []).length) {
        console.error(
          "Some tasks returned by the API have invalid MongoDB IDs.",
          response.tasks,
        );
      }

      setTasks(sortTasks(validTasks));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Create a task.
  const create = useCallback(
    async (input: CreateTaskInput) => {
      if (!projectId) {
        throw new Error("Cannot create a task without a project ID.");
      }

      setSaving(true);
      setError(null);

      try {
        const response = await createTaskRequest(projectId, input);
        const newTask = response.task;

        validateTaskId(newTask?._id);

        setTasks((current) =>
          sortTasks([
            ...current.filter((task) => task._id !== newTask._id),
            newTask,
          ]),
        );

        return newTask;
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [projectId],
  );

  // Update a task.
  const update = useCallback(
    async (taskId: string, input: Partial<CreateTaskInput>) => {
      const id = validateTaskId(taskId);
      const previousTasks = tasks;

      setSaving(true);
      setError(null);

      try {
        const response = await updateTaskRequest(id, input);
        const updatedTask = response.task;

        validateTaskId(updatedTask?._id);

        setTasks((current) =>
          sortTasks(
            current.map((task) => (task._id === id ? updatedTask : task)),
          ),
        );

        return updatedTask;
      } catch (err) {
        setTasks(previousTasks);

        const message = errorMessage(err);
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [tasks],
  );

  // Delete a task.
  const remove = useCallback(
    async (taskId: string) => {
      const id = validateTaskId(taskId);
      const previousTasks = tasks;

      setTasks((current) => current.filter((task) => task._id !== id));
      setError(null);

      try {
        await deleteTaskRequest(id);
      } catch (err) {
        setTasks(previousTasks);

        const message = errorMessage(err);
        setError(message);
        throw new Error(message);
      }
    },
    [tasks],
  );

  // Move a task to another status or position.
  const moveTask = useCallback(
    async (taskId: string, status: TaskStatus, targetIndex: number) => {
      let id: string;

      try {
        id = validateTaskId(taskId);
      } catch (err) {
        setError(errorMessage(err));
        return;
      }

      if (movingTaskIds.includes(id)) {
        return;
      }

      const previousTasks = tasks;
      const draggedTask = previousTasks.find((task) => task._id === id);

      if (!draggedTask) {
        setError(`Task not found on the board. Task ID: ${id}`);
        return;
      }

      // Build the target column without the dragged task.
      const targetColumn = previousTasks
        .filter((task) => task.status === status && task._id !== id)
        .sort((a, b) => a.position - b.position);

      const boundedIndex = Math.max(
        0,
        Math.min(
          Number.isFinite(targetIndex)
            ? Math.floor(targetIndex)
            : targetColumn.length,
          targetColumn.length,
        ),
      );

      targetColumn.splice(boundedIndex, 0, {
        ...draggedTask,
        status,
      });

      // Recalculate positions in the target column.
      const reindexedTarget = targetColumn.map((task, index) => ({
        ...task,
        status,
        position: index,
      }));

      // Keep tasks from all other columns.
      const otherTasks = previousTasks.filter(
        (task) => task._id !== id && task.status !== status,
      );

      const optimisticTasks = sortTasks([...otherTasks, ...reindexedTarget]);

      setTasks(optimisticTasks);
      setError(null);
      setMovingTaskIds((current) => [...current, id]);

      try {
        await moveTaskRequest(id, {
          status,
          position: boundedIndex,
        });

        // Load canonical positions from the server.
        const response = await getProjectTasks(projectId, {
          limit: 100,
        });

        setTasks(sortTasks(response.tasks ?? []));
      } catch (err) {
        // Restore the previous board if the move fails.
        setTasks(previousTasks);

        const message = errorMessage(err);
        setError(`Could not move task: ${message}`);
      } finally {
        setMovingTaskIds((current) =>
          current.filter((movingId) => movingId !== id),
        );
      }
    },
    [tasks, movingTaskIds, projectId],
  );

  return {
    tasks,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    moveTask,
    movingTaskIds,
    saving,
  };
}
