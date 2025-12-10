// Categories page with full CRUD functionality
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiEdit, FiTrash2, FiPlus, FiGrid } from "react-icons/fi";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/categories";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import type { Category, CategoryInput } from "../types";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

const CategoriesPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const queryClient = useQueryClient();

  // Queries
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories = categoriesData?.categories || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsModalOpen(false);
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryInput }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsModalOpen(false);
      setEditingCategory(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  const onSubmit = (data: CategoryFormData) => {
    const categoryData: CategoryInput = {
      name: data.name,
      description: data.description || undefined,
    };

    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory._id,
        data: categoryData,
      });
    } else {
      createMutation.mutate(categoryData);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setValue("name", category.name);
    setValue("description", category.description || "");
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this category? This action cannot be undone."
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const openModal = () => {
    setEditingCategory(null);
    reset();
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize your transactions with custom categories
          </p>
        </div>
        <Button onClick={openModal} icon={<FiPlus className="w-4 h-4" />}>
           Add Category
        </Button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.length === 0 ? (
          <div className="col-span-full">
            <Card className="text-center py-16">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiGrid className="w-8 h-8 text-slate-400" />
               </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No categories yet</h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Create categories like "Food", "Rent", or "Entertainment" to better track your spending.
              </p>
              <Button onClick={openModal}>
                Create Category
              </Button>
            </Card>
          </div>
        ) : (
          categories.map((category) => (
            <Card
                key={category._id}
                hoverable
                className="flex flex-col h-full bg-white/50 backdrop-blur-sm p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                    <FiGrid className="w-5 h-5" />
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit category"
                  >
                    <FiEdit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category._id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    disabled={deleteMutation.isPending}
                    title="Delete category"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-sm text-slate-500 line-clamp-2">
                      {category.description}
                    </p>
                  )}
              </div>
              
              <div className="mt-auto pt-4 flex items-center text-xs text-slate-400">
                 Created {new Date(category.createdAt).toLocaleDateString()}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
          reset();
        }}
        title={editingCategory ? "Edit Category" : "New Category"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Name"
            placeholder="e.g., Groceries, Rent, Salary"
            error={errors.name?.message}
            {...register("name")}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              {...register("description")}
              className="block w-full rounded-xl border-slate-200 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3"
              rows={3}
              placeholder="Optional description..."
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingCategory(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CategoriesPage;
