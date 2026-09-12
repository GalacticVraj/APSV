import { Router, Response, NextFunction } from 'express';
import db from '../services/db';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/notifications - for current user
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    const notifications = await db('notifications')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const unreadCount = await db('notifications')
      .where({ user_id: req.user!.id, read: false })
      .count('* as count')
      .first();

    res.json({
      notifications,
      unread_count: parseInt(unreadCount?.count as string || '0', 10),
      pagination: { page, limit },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await db('notifications')
      .where({ id: req.params.id, user_id: req.user!.id })
      .update({ read: true, updated_at: new Date() });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await db('notifications')
      .where({ user_id: req.user!.id, read: false })
      .update({ read: true, updated_at: new Date() });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

export default router;
