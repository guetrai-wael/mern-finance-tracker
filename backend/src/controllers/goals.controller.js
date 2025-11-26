/* Goals controller: financial goals and savings tracking */
const Goal = require('../models/goal.model');
const Transaction = require('../models/transaction.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, created, error } = require('../utils/response');

const listGoals = asyncHandler(async (req, res) => {
    const goals = await Goal.find({ user: req.user._id }).sort({ priority: -1, targetDate: 1 });
    return successList(res, goals, 'Goals retrieved successfully');
});

const createGoal = asyncHandler(async (req, res) => {
    const goal = await Goal.create({ ...req.body, user: req.user._id });
    return created(res, goal, 'Goal created successfully');
});

const updateGoal = asyncHandler(async (req, res) => {
    const goal = await Goal.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true });
    if (!goal) return error(res, 'Goal not found', 404);
    
    // Check if goal is completed
    if (goal.currentAmount >= goal.targetAmount && !goal.isCompleted) {
        goal.isCompleted = true;
        goal.completedAt = new Date();
        await goal.save();
    }
    
    return success(res, goal, 'Goal updated successfully');
});

const deleteGoal = asyncHandler(async (req, res) => {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!goal) return error(res, 'Goal not found', 404);
    return success(res, null, 'Goal deleted successfully');
});

const addContribution = asyncHandler(async (req, res) => {
    const { amount, description } = req.body;
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    
    // Update goal current amount
    goal.currentAmount += amount;
    
    // Check if goal is completed
    if (goal.currentAmount >= goal.targetAmount && !goal.isCompleted) {
        goal.isCompleted = true;
        goal.completedAt = new Date();
    }
    
    await goal.save();
    
    // Create a transaction for this contribution
    await Transaction.create({
        user: req.user._id,
        amount: amount,
        type: 'expense',
        description: description || `Contribution to ${goal.name}`,
        date: new Date()
    });
    
    return success(res, goal, 'Contribution added successfully');
});

module.exports = { listGoals, createGoal, updateGoal, deleteGoal, addContribution };