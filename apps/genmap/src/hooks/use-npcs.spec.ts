import { renderHook, waitFor, act } from '@testing-library/react';
import { useNpcs } from './use-npcs';

const PAGE_SIZE = 20;

let counter = 0;
function makeNpc(overrides: Partial<ReturnType<typeof makeNpc>> = {}) {
  counter += 1;
  return {
    id: `npc-${counter}`,
    mapId: `map-${counter}`,
    name: 'Test NPC',
    skin: 'scout_1',
    worldX: 0,
    worldY: 0,
    direction: 'down',
    personality: null,
    role: null,
    speechStyle: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useNpcs', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch NPCs on mount and return them', async () => {
    const npcs = [makeNpc({ name: 'Alice' }), makeNpc({ name: 'Bob' })];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => npcs,
    });

    const { result } = renderHook(() => useNpcs());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.npcs).toEqual(npcs);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/npcs?limit=${PAGE_SIZE}&offset=0`
    );
  });

  it('should set hasMore to true when response length equals PAGE_SIZE', async () => {
    const npcs = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeNpc({ name: `NPC ${i}` })
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => npcs,
    });

    const { result } = renderHook(() => useNpcs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
    expect(result.current.npcs).toHaveLength(PAGE_SIZE);
  });

  it('should set error when fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useNpcs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch NPCs');
    expect(result.current.npcs).toEqual([]);
  });

  it('should load more NPCs and append to existing list', async () => {
    const firstBatch = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeNpc({ name: `NPC ${i}` })
    );
    const secondBatch = [makeNpc({ name: 'Extra NPC' })];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstBatch,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => secondBatch,
      });

    const { result } = renderHook(() => useNpcs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.npcs).toHaveLength(PAGE_SIZE + 1);
    expect(result.current.hasMore).toBe(false);
    expect(global.fetch).toHaveBeenLastCalledWith(
      `/api/npcs?limit=${PAGE_SIZE}&offset=${PAGE_SIZE}`
    );
  });

  it('should not load more when already loading more', async () => {
    const npcs = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeNpc({ name: `NPC ${i}` })
    );

    // Slow-resolving second fetch to test guard
    let resolveSecond: (value: unknown) => void;
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => npcs,
      })
      .mockReturnValueOnce(secondPromise);

    const { result } = renderHook(() => useNpcs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start first loadMore (will be pending)
    act(() => {
      result.current.loadMore();
    });

    // Try second loadMore immediately - should be ignored
    await act(async () => {
      await result.current.loadMore();
    });

    // Only 2 fetch calls total: initial + one loadMore
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Clean up pending promise
    resolveSecond!({
      ok: true,
      json: async () => [],
    });
    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });
  });

  it('should not load more when hasMore is false', async () => {
    const npcs = [makeNpc()]; // less than PAGE_SIZE
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => npcs,
    });

    const { result } = renderHook(() => useNpcs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });

    // Only initial fetch, no loadMore
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should refetch from offset 0 and reset list', async () => {
    const firstBatch = [makeNpc({ name: 'First' })];
    const refetchBatch = [makeNpc({ name: 'Refetched' })];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstBatch,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => refetchBatch,
      });

    const { result } = renderHook(() => useNpcs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.npcs[0].name).toBe('First');

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.npcs[0].name).toBe('Refetched');
    expect(result.current.npcs).toHaveLength(1);
    // Both calls should be to offset=0
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `/api/npcs?limit=${PAGE_SIZE}&offset=0`
    );
  });

  it('should set error when loadMore fails', async () => {
    const npcs = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeNpc({ name: `NPC ${i}` })
    );

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => npcs,
      })
      .mockResolvedValueOnce({
        ok: false,
      });

    const { result } = renderHook(() => useNpcs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBe('Failed to fetch NPCs');
    expect(result.current.isLoadingMore).toBe(false);
  });
});
