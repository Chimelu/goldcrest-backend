import { Router } from 'express';
import {
  sequelize,
  User,
  UserWallet,
  AccountTransaction,
  WithdrawalRequest,
} from '../models';

const router = Router();

/** Add two USD decimal strings safely (2 dp). */
function addUsdString(current: string, add: number): string {
  const a = Math.round((Number(current) + add) * 100) / 100;
  if (!Number.isFinite(a) || a < 0) {
    throw new Error('Invalid balance after top-up');
  }
  return a.toFixed(2);
}

/**
 * GET /admin/users
 * List all users with wallet USD balance (no auth — add ADMIN_API_KEY / auth before production).
 */
router.get('/users', async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'fullName', 'isVerified', 'canTransact', 'createdAt'],
      include: [
        {
          model: UserWallet,
          as: 'wallet',
          attributes: ['availableUsd'],
          required: false,
        },
      ],
      order: [['id', 'ASC']],
    });

    return res.json({
      users: users.map(u => {
        const w = u.get('wallet') as InstanceType<typeof UserWallet> | undefined;
        return {
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          isVerified: u.isVerified,
          canTransact: Boolean(u.canTransact),
          createdAt: u.createdAt.toISOString(),
          availableUsd: w ? String(w.availableUsd) : '0.00',
          hasWallet: Boolean(w),
        };
      }),
    });
  } catch (e) {
    console.error('admin/users', e);
    return res.status(500).json({ message: 'Could not list users' });
  }
});

/**
 * PATCH /admin/users/:userId/can-transact
 * Body: { canTransact: boolean }
 */
router.patch('/users/:userId/can-transact', async (req, res) => {
  const userId = Number(req.params.userId);
  const canTransact = req.body?.canTransact;

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  if (typeof canTransact !== 'boolean') {
    return res.status(400).json({ message: 'canTransact must be boolean' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.canTransact = canTransact;
    await user.save();

    return res.json({
      message: 'User transact access updated',
      userId: user.id,
      canTransact: user.canTransact,
    });
  } catch (e) {
    console.error('admin/users can-transact', e);
    return res.status(500).json({ message: 'Could not update user access' });
  }
});

/**
 * POST /admin/users/:userId/top-up
 * Body: { amountUsd: number }
 * Credits user_wallets.available_usd and records a DEPOSIT transaction.
 */
router.post('/users/:userId/top-up', async (req, res) => {
  const userId = Number(req.params.userId);
  const amountUsd = Number(req.body?.amountUsd);

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return res.status(400).json({ message: 'amountUsd must be a positive number' });
  }
  if (amountUsd > 1_000_000_000) {
    return res.status(400).json({ message: 'amountUsd exceeds maximum allowed' });
  }

  type TxResult =
    | { ok: false; message: string }
    | {
        ok: true;
        userId: number;
        previousAvailableUsd: string;
        newAvailableUsd: string;
        creditedUsd: string;
      };

  try {
    const result = await sequelize.transaction(async (t): Promise<TxResult> => {
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!user) {
        return { ok: false, message: 'User not found' };
      }

      const [wallet] = await UserWallet.findOrCreate({
        where: { userId },
        defaults: { userId, availableUsd: '0.00' },
        transaction: t,
      });

      const prev = String(wallet.availableUsd);
      const next = addUsdString(prev, amountUsd);
      wallet.availableUsd = next;
      await wallet.save({ transaction: t });

      await AccountTransaction.create(
        {
          userId,
          kind: 'DEPOSIT',
          status: 'COMPLETED',
          cryptoSymbol: null,
          cryptoAmount: null,
          unitPriceUsd: null,
          grossUsd: amountUsd.toFixed(2),
          feeUsd: '0.00',
          idempotencyKey: null,
        },
        { transaction: t },
      );

      return {
        ok: true,
        userId,
        previousAvailableUsd: prev,
        newAvailableUsd: next,
        creditedUsd: amountUsd.toFixed(2),
      };
    });

    if (!result.ok) {
      return res.status(404).json({ message: result.message });
    }

    return res.json({
      message: 'Wallet topped up',
      userId: result.userId,
      previousAvailableUsd: result.previousAvailableUsd,
      newAvailableUsd: result.newAvailableUsd,
      creditedUsd: result.creditedUsd,
    });
  } catch (e) {
    console.error('admin/top-up', e);
    return res.status(500).json({ message: 'Top-up failed' });
  }
});

/**
 * GET /admin/transactions
 * All ledger rows (newest first).
 */
router.get('/transactions', async (_req, res) => {
  try {
    const rows = await AccountTransaction.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 300,
    });

    return res.json({
      transactions: rows.map(t => {
        const u = t.get('user') as InstanceType<typeof User> | undefined;
        return {
          id: t.id,
          userId: t.userId,
          userEmail: u?.email ?? null,
          kind: t.kind,
          status: t.status,
          cryptoSymbol: t.cryptoSymbol,
          cryptoAmount: t.cryptoAmount != null ? String(t.cryptoAmount) : null,
          unitPriceUsd: t.unitPriceUsd != null ? String(t.unitPriceUsd) : null,
          grossUsd: String(t.grossUsd),
          feeUsd: String(t.feeUsd),
          withdrawalRequestId: t.withdrawalRequestId,
          createdAt: t.createdAt.toISOString(),
        };
      }),
    });
  } catch (e) {
    console.error('admin/transactions', e);
    return res.status(500).json({ message: 'Could not load transactions' });
  }
});

/**
 * GET /admin/withdrawals
 */
router.get('/withdrawals', async (_req, res) => {
  try {
    const rows = await WithdrawalRequest.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullName'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 300,
    });

    return res.json({
      withdrawals: rows.map(w => {
        const u = w.get('user') as InstanceType<typeof User> | undefined;
        return {
          id: w.id,
          userId: w.userId,
          userEmail: u?.email ?? null,
          userFullName: u?.fullName ?? null,
          amountUsd: String(w.amountUsd),
          destinationAddress: w.destinationAddress,
          network: w.network,
          status: w.status,
          adminNote: w.adminNote,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        };
      }),
    });
  } catch (e) {
    console.error('admin/withdrawals', e);
    return res.status(500).json({ message: 'Could not load withdrawals' });
  }
});

/**
 * PATCH /admin/withdrawals/:id
 * Body: { status: "COMPLETED" | "REJECTED", adminNote?: string }
 */
router.patch('/withdrawals/:id', async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  const adminNote =
    typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : null;

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid id' });
  }
  if (status !== 'COMPLETED' && status !== 'REJECTED') {
    return res.status(400).json({ message: 'status must be COMPLETED or REJECTED' });
  }

  try {
    const result = await sequelize.transaction(async t => {
      const wr = await WithdrawalRequest.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!wr) {
        return { ok: false as const, message: 'Withdrawal not found' };
      }
      if (wr.status !== 'PENDING') {
        return { ok: false as const, message: 'Only PENDING withdrawals can be updated' };
      }

      const ledger = await AccountTransaction.findOne({
        where: { withdrawalRequestId: wr.id, kind: 'WITHDRAW' },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!ledger) {
        throw new Error('Ledger entry missing for withdrawal');
      }

      if (status === 'REJECTED') {
        const wallet = await UserWallet.findOne({
          where: { userId: wr.userId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!wallet) throw new Error('User wallet not found');
        const refund = Number(wr.amountUsd);
        wallet.availableUsd = (Number(wallet.availableUsd) + refund).toFixed(2);
        await wallet.save({ transaction: t });

        wr.status = 'REJECTED';
        wr.adminNote = adminNote;
        await wr.save({ transaction: t });

        ledger.status = 'FAILED';
        await ledger.save({ transaction: t });

        await AccountTransaction.create(
          {
            userId: wr.userId,
            kind: 'DEPOSIT',
            status: 'COMPLETED',
            cryptoSymbol: null,
            cryptoAmount: null,
            unitPriceUsd: null,
            grossUsd: refund.toFixed(2),
            feeUsd: '0.00',
            idempotencyKey: null,
            withdrawalRequestId: null,
          },
          { transaction: t },
        );

        return {
          ok: true as const,
          withdrawal: {
            id: wr.id,
            status: wr.status,
            newAvailableUsd: String(wallet.availableUsd),
          },
        };
      }

      wr.status = 'COMPLETED';
      wr.adminNote = adminNote;
      await wr.save({ transaction: t });

      ledger.status = 'COMPLETED';
      await ledger.save({ transaction: t });

      return {
        ok: true as const,
        withdrawal: {
          id: wr.id,
          status: wr.status,
        },
      };
    });

    if (!result.ok) {
      return res.status(404).json({ message: result.message });
    }

    return res.json({ message: 'Withdrawal updated', ...result.withdrawal });
  } catch (e) {
    console.error('admin/withdrawals PATCH', e);
    return res.status(500).json({
      message: e instanceof Error ? e.message : 'Update failed',
    });
  }
});

export default router;
