
export interface Card {
  id: string;
  message: string;
  children: Card[];
  isExpanding?: boolean;
}

export interface MindMapState {
  root: Card | null;
  loading: boolean;
  error: string | null;
}

export type LayoutDirection = 'LR' | 'TB';
