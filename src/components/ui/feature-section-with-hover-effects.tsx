import { cn } from "@/lib/utils";

interface FeatureItem {
  num: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface FeaturesSectionProps {
  features: FeatureItem[];
}

export function FeaturesSectionWithHoverEffects({ features }: FeaturesSectionProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
      {features.map((feature) => (
        <Feature key={feature.title} {...feature} />
      ))}
    </div>
  );
}

const Feature = ({
  num,
  title,
  description,
  icon,
}: {
  num: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) => {
  return (
    <div
      className={cn("relative overflow-hidden group/feature")}
      style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '36px 32px',
        border: '1px solid #E2EAF5',
        boxShadow: '0 4px 16px rgba(14,42,85,0.05)',
      }}
    >
      {/* Gradient overlay on hover */}
      <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-[#EEF2F8] to-transparent pointer-events-none" />

      {/* Número grande decorativo */}
      <div style={{
        position: 'absolute', top: '16px', right: '24px',
        fontSize: '64px', fontWeight: 900, color: '#EEF2F8',
        lineHeight: 1, letterSpacing: '-0.06em', userSelect: 'none',
        zIndex: 0,
      }}>
        {num}
      </div>

      {/* Left bar indicator */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 group-hover/feature:h-16 w-1 rounded-tr-full rounded-br-full bg-[#E2EAF5] group-hover/feature:bg-[#4A90E2] transition-all duration-300 origin-center" />

      {/* Icon box */}
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px',
        background: '#EEF2F8', display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: '20px', position: 'relative', zIndex: 1,
      }}>
        {icon}
      </div>

      {/* Title */}
      <h3
        className="group-hover/feature:translate-x-2 transition duration-200 inline-block"
        style={{ fontSize: '20px', fontWeight: 800, color: '#0E2A55', marginBottom: '12px', letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}
      >
        {title}
      </h3>

      {/* Description */}
      <p style={{ color: '#6B7A99', fontSize: '15px', lineHeight: 1.7, margin: 0, position: 'relative', zIndex: 1 }}>
        {description}
      </p>
    </div>
  );
};
