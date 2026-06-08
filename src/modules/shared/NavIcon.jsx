import {
  Home, GraduationCap, BookMarked, Telescope, Globe,
  Layers, Mic2, Archive, TrendingUp, Inbox,
  Scale, Compass, PlayCircle, ClipboardList,
} from 'lucide-react';

const MAP = {
  home:      Home,
  learn:     GraduationCap,
  books:     BookMarked,
  research:  Telescope,
  translate: Globe,
  projects:  Layers,
  podcast:   Mic2,
  vault:     Archive,
  growth:    TrendingUp,
  inbox:     Inbox,
  decisions: Scale,
  coach:     Compass,
  ted:       PlayCircle,
  quiz:      ClipboardList,
};

export default function NavIcon({ id, size = 16, strokeWidth = 1.8 }) {
  const Icon = MAP[id];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
