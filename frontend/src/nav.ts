import {FileText, Landmark, Phone} from 'lucide-react';
import type {Channel} from './api';

export const channels: Channel[] = ['helpline', 'bank', 'portal'];
export const icons = {helpline: Phone, bank: Landmark, portal: FileText};

export function go(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
