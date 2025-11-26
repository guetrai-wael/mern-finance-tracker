/* Categories controller: user-specific custom categories */
const Category = require('../models/category.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, created, error } = require('../utils/response');

const listCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find({ user: req.user._id });
    return successList(res, categories, 'Categories retrieved successfully');
});

const createCategory = asyncHandler(async (req, res) => {
    const existing = await Category.findOne({ user: req.user._id, name: req.body.name });
    if (existing) return error(res, 'Category already exists', 400);
    const category = await Category.create({ ...req.body, user: req.user._id });
    return created(res, category, 'Category created successfully');
});

const updateCategory = asyncHandler(async (req, res) => {
    const category = await Category.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true });
    if (!category) return error(res, 'Category not found', 404);
    return success(res, category, 'Category updated successfully');
});

const deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!category) return error(res, 'Category not found', 404);
    return success(res, null, 'Category deleted successfully');
});

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
