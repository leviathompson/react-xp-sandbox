import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useContext } from "../../context/context";
import styles from "./ContextMenu.module.scss";
import type { ContextMenuItem } from "../../context/types";

const VIEWPORT_PADDING = 6;

const MenuList = ({ items }: { items: ContextMenuItem[] }) => {
    const { closeContextMenu } = useContext();

    const onItemClick = (item: ContextMenuItem) => {
        if (item.disabled || item.submenu?.length) return;

        item.onSelect?.();
        closeContextMenu();
    };

    return (
        <ul className={styles.menuList} role="menu">
            {items.map((item) => {
                if (item.separator) {
                    return <li key={item.id} className={styles.separator} role="separator" />;
                }

                const hasSubmenu = !!item.submenu?.length;

                return (
                    <li
                        key={item.id}
                        className={styles.menuItem}
                        data-disabled={item.disabled}
                        data-has-submenu={hasSubmenu}
                    >
                        <button type="button" onClick={() => onItemClick(item)} disabled={item.disabled} role="menuitem">
                            <span className={styles.checkmark}>{item.checked ? "✓" : ""}</span>
                            <span className={styles.label}>{item.label}</span>
                            <span className={styles.chevron}>{hasSubmenu ? "▶" : ""}</span>
                        </button>
                        {hasSubmenu && item.submenu && (
                            <div className={styles.submenu}>
                                <MenuList items={item.submenu} />
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

const ContextMenu = () => {
    const { contextMenu, closeContextMenu } = useContext();
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!contextMenu) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (menuRef.current?.contains(event.target as Node)) return;
            closeContextMenu();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeContextMenu();
        };

        const handleViewportChange = () => closeContextMenu();

        document.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", handleViewportChange);
        window.addEventListener("scroll", handleViewportChange, true);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("resize", handleViewportChange);
            window.removeEventListener("scroll", handleViewportChange, true);
        };
    }, [closeContextMenu, contextMenu]);

    useLayoutEffect(() => {
        if (!contextMenu || !menuRef.current) return;

        const { width, height } = menuRef.current.getBoundingClientRect();
        const nextX = Math.max(VIEWPORT_PADDING, Math.min(contextMenu.x, window.innerWidth - width - VIEWPORT_PADDING));
        const nextY = Math.max(VIEWPORT_PADDING, Math.min(contextMenu.y, window.innerHeight - height - VIEWPORT_PADDING));

        setPosition({ x: nextX, y: nextY });
    }, [contextMenu]);

    if (!contextMenu) return null;

    return (
        <div
            ref={menuRef}
            className={styles.contextMenu}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onContextMenu={(event) => event.preventDefault()}
        >
            <MenuList items={contextMenu.items} />
        </div>
    );
};

export default ContextMenu;
