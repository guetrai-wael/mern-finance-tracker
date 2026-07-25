/* Notifications controller: the in-app alert inbox. */
const Notification = require('../models/notification.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, error } = require('../utils/response');

const listNotifications = asyncHandler(async (req, res) => {
    const { unread, limit = 20, page = 1 } = req.query;

    const filter = { user: req.user._id };
    if (unread === 'true') filter.read = false;

    const perPage = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * perPage;

    const [items, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ user: req.user._id, read: false })
    ]);

    return successList(res, items, 'Notifications retrieved successfully', { total, unreadCount, page: Number(page) });
});

const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    return success(res, { count }, 'Unread count retrieved successfully');
});

const markRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { read: true, readAt: new Date() },
        { new: true }
    );

    if (!notification) return error(res, 'Notification not found', 404);
    return success(res, notification, 'Notification marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
        { user: req.user._id, read: false },
        { read: true, readAt: new Date() }
    );

    return success(res, { updated: result.modifiedCount }, 'All notifications marked as read');
});

const deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notification) return error(res, 'Notification not found', 404);
    return success(res, null, 'Notification deleted successfully');
});

module.exports = { listNotifications, getUnreadCount, markRead, markAllRead, deleteNotification };
