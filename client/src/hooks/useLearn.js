import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';

export const useLessons = () => useQuery({ queryKey: ['learn', 'lessons'], queryFn: () => api.get('/learn/lessons') });
export const useLesson = (id) => useQuery({ queryKey: ['learn', 'lesson', id], queryFn: () => api.get(`/learn/lessons/${id}`), enabled: !!id });
export const useReport = () => useQuery({ queryKey: ['learn', 'report'], queryFn: () => api.get('/learn/report') });

export function useStudied() {
  return useMutation({ mutationFn: ({ gestureId, lessonId }) => api.post(`/learn/signs/${gestureId}/studied`, { lessonId }) });
}

/** Start and submit server-graded tests; refreshes progress afterwards. */
export function useTest() {
  const qc = useQueryClient();
  const start = useMutation({ mutationFn: (body) => api.post('/learn/tests', body) });
  const submit = useMutation({
    mutationFn: ({ id, answers }) => api.post(`/learn/tests/${id}/submit`, { answers }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn'] }),
  });
  return { start, submit };
}
