import { useEffect, useRef, useState } from 'react';

type Placement = 'before' | 'after';

type DragState<ItemId extends string> = {
  activeId: ItemId | '';
  overId: ItemId | '';
  placement: Placement;
  dragging: boolean;
};

export function usePointerSortableList<ItemId extends string>(input: {
  ids: ItemId[];
  onReorder: (sourceId: ItemId, targetId: ItemId, placement: Placement) => void;
  activationDistance?: number;
}) {
  const itemsRef = useRef(new Map<ItemId, HTMLElement>());
  const idsRef = useRef(input.ids);
  const onReorderRef = useRef(input.onReorder);
  const activationDistance = input.activationDistance ?? 6;

  idsRef.current = input.ids;
  onReorderRef.current = input.onReorder;

  const dragRef = useRef<{
    pointerId: number | null;
    activeId: ItemId | '';
    overId: ItemId | '';
    placement: Placement;
    startX: number;
    startY: number;
    dragging: boolean;
  }>({
    pointerId: null,
    activeId: '',
    overId: '',
    placement: 'before',
    startX: 0,
    startY: 0,
    dragging: false,
  });

  const suppressClickUntilRef = useRef(0);
  const [dragState, setDragState] = useState<DragState<ItemId>>({
    activeId: '',
    overId: '',
    placement: 'before',
    dragging: false,
  });

  const resetDragState = () => {
    dragRef.current = {
      pointerId: null,
      activeId: '',
      overId: '',
      placement: 'before',
      startX: 0,
      startY: 0,
      dragging: false,
    };
    setDragState({
      activeId: '',
      overId: '',
      placement: 'before',
      dragging: false,
    });
  };

  const resolveDropTarget = (clientY: number) => {
    const items = idsRef.current
      .map((id) => {
        const node = itemsRef.current.get(id);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        return {
          id,
          rect: node.getBoundingClientRect(),
        };
      })
      .filter(Boolean) as Array<{ id: ItemId; rect: DOMRect }>;

    if (!items.length) {
      return null;
    }

    for (const item of items) {
      const midpoint = item.rect.top + item.rect.height / 2;
      if (clientY < midpoint) {
        return { id: item.id, placement: 'before' as Placement };
      }
    }

    const last = items[items.length - 1];
    return last ? { id: last.id, placement: 'after' as Placement } : null;
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (current.pointerId !== event.pointerId || !current.activeId) {
        return;
      }

      if (!current.dragging) {
        const deltaX = Math.abs(event.clientX - current.startX);
        const deltaY = Math.abs(event.clientY - current.startY);
        if (Math.max(deltaX, deltaY) < activationDistance) {
          return;
        }
        current.dragging = true;
      }

      const target = resolveDropTarget(event.clientY);
      const nextOverId = target && target.id !== current.activeId ? target.id : '';
      const nextPlacement = target ? target.placement : 'before';

      if (nextOverId === current.overId && nextPlacement === current.placement && current.dragging === dragState.dragging) {
        return;
      }

      current.overId = nextOverId;
      current.placement = nextPlacement;
      setDragState({
        activeId: current.activeId,
        overId: nextOverId,
        placement: nextPlacement,
        dragging: true,
      });

      // Live-reorder during pointer move so surrounding cards visibly make space.
      if (nextOverId && nextOverId !== current.activeId) {
        onReorderRef.current(current.activeId, nextOverId, nextPlacement);
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const current = dragRef.current;
      if (current.pointerId !== event.pointerId || !current.activeId) {
        return;
      }

      const sourceId = current.activeId;
      const wasDragging = current.dragging;
      resetDragState();

      if (!wasDragging) {
        return;
      }

      suppressClickUntilRef.current = Date.now() + 250;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [activationDistance, dragState.activeId, dragState.dragging, dragState.overId, dragState.placement]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    idsRef.current.forEach((id) => {
      const node = itemsRef.current.get(id);
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const handler = (event: PointerEvent) => {
        if (event.button !== 0) {
          return;
        }
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('button, input, textarea, select, a, [data-no-drag=\"true\"]')) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        dragRef.current = {
          pointerId: event.pointerId,
          activeId: id,
          overId: '',
          placement: 'before',
          startX: event.clientX,
          startY: event.clientY,
          dragging: false,
        };
        setDragState({
          activeId: id,
          overId: '',
          placement: 'before',
          dragging: false,
        });
      };
      node.addEventListener('pointerdown', handler);
      cleanups.push(() => node.removeEventListener('pointerdown', handler));
    });
    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [input.ids]);

  return {
    dragState,
    setItemRef: (id: ItemId, node: HTMLElement | null) => {
      if (node) {
        itemsRef.current.set(id, node);
        return;
      }
      itemsRef.current.delete(id);
    },
    isClickSuppressed: () => Date.now() < suppressClickUntilRef.current,
  };
}
