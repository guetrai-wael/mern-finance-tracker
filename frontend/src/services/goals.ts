// Goal API service functions
import { api } from "../lib/api";
import type { Goal, GoalInput, GoalContribution } from "../types";

export const getGoals = async (): Promise<{ goals: Goal[] }> => {
  const response = await api.get("/goals");
  return { goals: response.data.data || [] };
};

export const createGoal = async (data: GoalInput): Promise<{ goal: Goal }> => {
  const response = await api.post("/goals", data);
  return { goal: response.data.data };
};

export const updateGoal = async (
  id: string,
  data: Partial<GoalInput>
): Promise<{ goal: Goal }> => {
  const response = await api.put(`/goals/${id}`, data);
  return { goal: response.data.data };
};

export const deleteGoal = async (id: string): Promise<void> => {
  await api.delete(`/goals/${id}`);
};

export const addGoalContribution = async (
  id: string,
  data: GoalContribution
): Promise<{ goal: Goal }> => {
  const response = await api.post(`/goals/${id}/contribute`, data);
  return { goal: response.data.data };
};
