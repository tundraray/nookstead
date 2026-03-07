import { renderHook, waitFor, act } from '@testing-library/react';
import { useNpcDialogues } from './use-npc-dialogues';

const PAGE_SIZE = 20;

let counter = 0;
function makeSession(
  overrides: Record<string, unknown> = {}
): {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  userId: string;
  userName: string | null;
  userEmail: string;
  messageCount: number;
} {
  counter += 1;
  return {
    sessionId: `session-${counter}`,
    startedAt: new Date().toISOString(),
    endedAt: null,
    userId: `user-${counter}`,
    userName: `User ${counter}`,
    userEmail: `user${counter}@example.com`,
    messageCount: 5,
    ...overrides,
  };
}

function makeMessage(
  overrides: Record<string, unknown> = {}
): {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
} {
  counter += 1;
  return {
    id: `msg-${counter}`,
    sessionId: `session-${counter}`,
    role: 'user',
    content: `Message ${counter}`,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useNpcDialogues', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    counter = 0;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should not fetch when botId is null', async () => {
    const { result } = renderHook(() => useNpcDialogues(null));

    // Wait a tick to ensure no async operation fires
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.sessions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should fetch sessions when botId is provided', async () => {
    const sessions = [makeSession(), makeSession()];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => sessions,
    });

    const { result } = renderHook(() => useNpcDialogues('bot-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sessions).toEqual(sessions);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/npcs/bot-1/dialogues?limit=${PAGE_SIZE}&offset=0`
    );
  });

  it('should set hasMore when sessions length equals PAGE_SIZE', async () => {
    const sessions = Array.from({ length: PAGE_SIZE }, () => makeSession());
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => sessions,
    });

    const { result } = renderHook(() => useNpcDialogues('bot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
  });

  it('should set error when fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useNpcDialogues('bot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch dialogue sessions');
    expect(result.current.sessions).toEqual([]);
  });

  it('should load more sessions and append', async () => {
    const firstBatch = Array.from({ length: PAGE_SIZE }, () => makeSession());
    const secondBatch = [makeSession()];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstBatch,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => secondBatch,
      });

    const { result } = renderHook(() => useNpcDialogues('bot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.sessions).toHaveLength(PAGE_SIZE + 1);
    expect(result.current.hasMore).toBe(false);
    expect(global.fetch).toHaveBeenLastCalledWith(
      `/api/npcs/bot-1/dialogues?limit=${PAGE_SIZE}&offset=${PAGE_SIZE}`
    );
  });

  it('should refetch from offset 0', async () => {
    const firstBatch = [makeSession()];
    const refetchBatch = [makeSession({ userName: 'Refetched' })];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstBatch,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => refetchBatch,
      });

    const { result } = renderHook(() => useNpcDialogues('bot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.sessions).toEqual(refetchBatch);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `/api/npcs/bot-1/dialogues?limit=${PAGE_SIZE}&offset=0`
    );
  });

  it('should re-fetch when botId changes', async () => {
    const sessionsBot1 = [makeSession()];
    const sessionsBot2 = [makeSession(), makeSession()];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sessionsBot1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sessionsBot2,
      });

    const { result, rerender } = renderHook(
      ({ botId }: { botId: string | null }) => useNpcDialogues(botId),
      { initialProps: { botId: 'bot-1' } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sessions).toEqual(sessionsBot1);

    rerender({ botId: 'bot-2' });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sessions).toEqual(sessionsBot2);
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/npcs/bot-2/dialogues?limit=${PAGE_SIZE}&offset=0`
    );
  });

  it('should fetchSessionMessages on demand', async () => {
    const sessions = [makeSession()];
    const messages = [
      makeMessage({ role: 'user', content: 'Hello' }),
      makeMessage({ role: 'assistant', content: 'Hi there!' }),
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sessions,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => messages,
      });

    const { result } = renderHook(() => useNpcDialogues('bot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const returnedMessages = await result.current.fetchSessionMessages(
      'session-abc'
    );

    expect(returnedMessages).toEqual(messages);
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/npcs/bot-1/dialogues?sessionId=session-abc'
    );
  });

  it('should throw when fetchSessionMessages is called with null botId', async () => {
    const { result } = renderHook(() => useNpcDialogues(null));

    await expect(
      result.current.fetchSessionMessages('session-abc')
    ).rejects.toThrow('No NPC selected');
  });

  it('should throw when fetchSessionMessages fetch fails', async () => {
    const sessions = [makeSession()];
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sessions,
      })
      .mockResolvedValueOnce({
        ok: false,
      });

    const { result } = renderHook(() => useNpcDialogues('bot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.fetchSessionMessages('session-abc')
    ).rejects.toThrow('Failed to fetch session messages');
  });
});
