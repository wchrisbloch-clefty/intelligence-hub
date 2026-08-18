// One icon primitive for the whole app. Icons are referenced by lucide-react
// NAME (a string, so registries and constants stay data) and render with
// `stroke: currentColor` so they inherit text color. One size scale — 16 inline,
// 20 section headers, 24 nav. No emoji in UI chrome.
//
// Icons are imported explicitly (never `import *`) so the bundle only ships the
// ones actually used — a namespace import pulls the whole ~1MB set. Add a name
// here when a new registry references it.
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, BarChart3, Bookmark, BookMarked,
  BookOpen, Brain, Briefcase, Building2, CalendarClock, Check, ChevronDown,
  ChevronUp, Circle, Clock, ClipboardList, Cog, Compass, Cpu, DollarSign, Drama,
  Dumbbell, Eye, EyeOff, Feather, FileSpreadsheet, FileText, Flame, Globe,
  GraduationCap, Handshake, Heart, Image, Inbox, Landmark, Layers, Library,
  MapPin, MessageSquare, Microscope, Mountain, Newspaper, Package, Paperclip,
  PenSquare, Play, Plus, Presentation, Radio, RefreshCw, Rocket, Rows2, Rows3,
  Scale, Search, Settings2, Share2, Sparkles, Sprout, Stethoscope, StickyNote,
  Target, TrendingUp, TrendingDown, Trophy, Waves, X, Zap,
} from 'lucide-react';

const REGISTRY = {
  Activity, ArrowDown, ArrowRight, ArrowUp, BarChart3, Bookmark, BookMarked,
  BookOpen, Brain, Briefcase, Building2, CalendarClock, Check, Clock, ChevronDown,
  ChevronUp, Circle, ClipboardList, Cog, Compass, Cpu, DollarSign, Drama,
  Dumbbell, Eye, EyeOff, Feather, FileSpreadsheet, FileText, Flame, Globe,
  GraduationCap, Handshake, Heart, Image, Inbox, Landmark, Layers, Library,
  MapPin, MessageSquare, Microscope, Mountain, Newspaper, Package, Paperclip,
  PenSquare, Play, Plus, Presentation, Radio, RefreshCw, Rocket, Rows2, Rows3,
  Scale, Search, Settings2, Share2, Sparkles, Sprout, Stethoscope, StickyNote,
  Target, TrendingUp, TrendingDown, Trophy, Waves, X, Zap,
};

const SIZES = { inline: 16, header: 20, nav: 24 };

export default function Icon({ name, size = 'inline', strokeWidth = 1.8, style, ...rest }) {
  const Cmp = REGISTRY[name] || Circle;
  const px = typeof size === 'number' ? size : (SIZES[size] || 16);
  return <Cmp size={px} strokeWidth={strokeWidth} style={{ flexShrink: 0, ...style }} {...rest} />;
}
