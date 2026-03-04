import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "usehooks-ts";
import type { LucideIcon } from "lucide-react";

interface Tab {
    title: string;
    icon: LucideIcon;
    type?: never;
    to?: string;
}

interface Separator {
    type: "separator";
    title?: never;
    icon?: never;
    to?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
    tabs: TabItem[];
    activeIndex?: number | null;
    onSelect?: (index: number) => void;
}

const buttonVariants = {
    initial: { gap: 0, paddingLeft: ".5rem", paddingRight: ".5rem" },
    animate: (isSelected: boolean) => ({
        gap: isSelected ? ".5rem" : 0,
        paddingLeft: isSelected ? "1rem" : ".5rem",
        paddingRight: isSelected ? "1rem" : ".5rem",
    }),
};

const spanVariants = {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1 },
    exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring" as const, bounce: 0, duration: 0.6 };

export function ExpandableTabs({ tabs, activeIndex, onSelect }: ExpandableTabsProps) {
    const [hovered, setHovered] = React.useState<number | null>(null);
    const ref = React.useRef<HTMLDivElement>(null!);

    useOnClickOutside(ref, () => setHovered(null));

    const SeparatorEl = () => (
        <div
            style={{
                width: "1.2px",
                height: "24px",
                background: "var(--border-light, #E2EAF5)",
                margin: "0 4px",
                flexShrink: 0,
            }}
            aria-hidden="true"
        />
    );

    return (
        <div
            ref={ref}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "var(--bg-white, #fff)",
                border: "1px solid var(--border-light, #E2EAF5)",
                borderRadius: "16px",
                padding: "6px",
                boxShadow: "0 2px 10px rgba(14,42,85,0.07)",
            }}
        >
            {tabs.map((tab, index) => {
                if (tab.type === "separator") {
                    return <SeparatorEl key={`sep-${index}`} />;
                }

                const Icon = tab.icon;
                const isActive = activeIndex === index;
                const isHovered = hovered === index;
                const isHighlighted = isActive || isHovered;

                return (
                    <motion.button
                        key={tab.title}
                        variants={buttonVariants}
                        initial={false}
                        animate="animate"
                        custom={isHighlighted}
                        transition={transition}
                        onMouseEnter={() => setHovered(index)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => onSelect?.(index)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "38px",
                            borderRadius: "10px",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            background: isActive
                                ? "rgba(42,96,194,0.10)"
                                : isHovered
                                    ? "var(--snow, #F8FAFF)"
                                    : "transparent",
                            color: isActive
                                ? "#2A60C2"
                                : isHovered
                                    ? "var(--text-dark, #0E2A55)"
                                    : "var(--text-muted, #94A3B8)",
                            transition: "background 0.2s, color 0.2s",
                        }}
                    >
                        <Icon size={18} strokeWidth={2.5} />
                        <AnimatePresence initial={false}>
                            {isHighlighted && (
                                <motion.span
                                    variants={spanVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={transition}
                                    style={{ overflow: "hidden", display: "inline-block" }}
                                >
                                    {tab.title}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                );
            })}
        </div>
    );
}
