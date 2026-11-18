import { useRef, type DragEvent } from "react";

/** Drag-and-drop props that move the dragged tab to where the one it's dropped on is. */
export function useTabDrag(move: (name: string, to: string) => void) {
  const dragged = useRef<string | null>(null);

  return (name: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      dragged.current = name;
      e.dataTransfer.setData("text/plain", name);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent) => {
      if (dragged.current) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragged.current) move(dragged.current, name);
      dragged.current = null;
    },
    onDragEnd: () => {
      dragged.current = null;
    },
  });
}
