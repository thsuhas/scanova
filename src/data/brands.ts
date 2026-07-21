import nikeLogo from '../assets/logos/nike.svg';
import adidasLogo from '../assets/logos/adidas.svg';
import pumaLogo from '../assets/logos/puma.svg';
import zaraLogo from '../assets/logos/Zara.svg';
import hmLogo from '../assets/logos/H&M.svg';
import levisLogo from '../assets/logos/Levi\'s.svg';
import gucciLogo from '../assets/logos/Gucci_Logo.svg';
import lvLogo from '../assets/logos/Louis_Vuitton.svg';
import uniqloLogo from '../assets/logos/uniqlo.svg';
import tommyLogo from '../assets/logos/tommy-hilfiger.svg';
import ckLogo from '../assets/logos/Calvin_klein.svg';
import mangoLogo from '../assets/logos/Mango.svg';
import underarmourLogo from '../assets/logos/underarmour.svg';
import reebokLogo from '../assets/logos/Reebok.svg';

export interface Brand {
  id: string;
  name: string;
  logo: string;
  color: string;
  glow: string;
  gradient: string;
}

export const brands: Brand[] = [
  { id: 'nike', name: 'Nike', logo: nikeLogo, color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.5)', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.03))' },
  { id: 'adidas', name: 'Adidas', logo: adidasLogo, color: '#00D4FF', glow: 'rgba(0, 212, 255, 0.5)', gradient: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.03))' },
  { id: 'puma', name: 'Puma', logo: pumaLogo, color: '#EC4899', glow: 'rgba(236, 72, 153, 0.5)', gradient: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(236,72,153,0.03))' },
  { id: 'zara', name: 'Zara', logo: zaraLogo, color: '#6B7280', glow: 'rgba(107, 114, 128, 0.5)', gradient: 'linear-gradient(135deg, rgba(107,114,128,0.15), rgba(107,114,128,0.03))' },
  { id: 'hm', name: 'H&M', logo: hmLogo, color: '#EF4444', glow: 'rgba(239, 68, 68, 0.5)', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.03))' },
  { id: 'levis', name: "Levi's", logo: levisLogo, color: '#F97316', glow: 'rgba(249, 115, 22, 0.5)', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.03))' },
  { id: 'gucci', name: 'Gucci', logo: gucciLogo, color: '#10B981', glow: 'rgba(16, 185, 129, 0.5)', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.03))' },
  { id: 'louisvuitton', name: 'Louis Vuitton', logo: lvLogo, color: '#EAB308', glow: 'rgba(234, 179, 8, 0.5)', gradient: 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.03))' },
  { id: 'uniqlo', name: 'Uniqlo', logo: uniqloLogo, color: '#D946EF', glow: 'rgba(217, 70, 239, 0.5)', gradient: 'linear-gradient(135deg, rgba(217,70,239,0.15), rgba(217,70,239,0.03))' },
  { id: 'tommy', name: 'Tommy Hilfiger', logo: tommyLogo, color: '#4F46E5', glow: 'rgba(79, 70, 229, 0.5)', gradient: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(79,70,229,0.03))' },
  { id: 'calvinklein', name: 'Calvin Klein', logo: ckLogo, color: '#94A3B8', glow: 'rgba(148, 163, 184, 0.5)', gradient: 'linear-gradient(135deg, rgba(148,163,184,0.15), rgba(148,163,184,0.03))' },
  { id: 'mango', name: 'Mango', logo: mangoLogo, color: '#FB923C', glow: 'rgba(251, 146, 60, 0.5)', gradient: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.03))' },
  { id: 'underarmour', name: 'Under Armour', logo: underarmourLogo, color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.5)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.03))' },
  { id: 'reebok', name: 'Reebok', logo: reebokLogo, color: '#F97316', glow: 'rgba(249, 115, 22, 0.5)', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.03))' },
];
