import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';

/** Join or leave a session, then refresh the page data and the user's XP. */
export function useJoinSession(onChanged: () => void) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggle(session: { id: string; title: string; joined: boolean }) {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setPendingId(session.id);
    try {
      if (session.joined) {
        await api.delete(`/sessions/${session.id}/join`);
        toast(`Left “${session.title}”`, 'info');
      } else {
        const res = await api.post<{ xpEarned: number }>(`/sessions/${session.id}/join`);
        toast(`You're in! +${res.data.xpEarned} XP`);
      }
      onChanged();
      await refreshUser();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setPendingId(null);
    }
  }

  return { toggle, pendingId };
}
