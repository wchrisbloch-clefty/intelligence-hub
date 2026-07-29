import {
  Home, GraduationCap, BookMarked, Telescope, Globe,
  Layers, Mic2, Archive, TrendingUp, Inbox,
  Scale, Compass, PlayCircle, ClipboardList, Route, Microscope, Wand2, Landmark,
} from 'lucide-react';

const MAP = {
  home:      Home,
  learn:     GraduationCap,
  academy:   Landmark,
  ladder:    Route,
  books:     BookMarked,
  research:  Telescope,
  deepdive:  Microscope,
  translate: Globe,
  projects:  Layers,
  podcast:   Mic2,
  vault:     Archive,
  growth:    TrendingUp,
  inbox:     Inbox,
  decisions: Scale,
  coach:     Compass,
  studio:    Wand2,
  ted:       PlayCircle,
  quiz:      ClipboardList,
};

export default function NavIcon({ id, size = 16, strokeWidth = 1.8 }) {
  const Icon = MAP[id];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
