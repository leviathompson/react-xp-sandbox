import { useContext } from "../../context/context";
import styles from "./WindowMenu.module.scss";
import type { ContextMenuItem } from "../../context/types";

export interface WindowMenuDefinition {
    label: string;
    items: ContextMenuItem[];
}

interface WindowMenuProps {
    menuItems?: string[];
    menus?: WindowMenuDefinition[];
    hasWindowsLogo?: boolean;
    isMinified?: boolean;
}

const WindowMenu = ({ menuItems = [], menus = undefined, hasWindowsLogo = false, isMinified = false }: WindowMenuProps) => {
    const { openContextMenu } = useContext();
    const labels = menus?.map((menu) => menu.label) || menuItems;

    const onMenuClick = (
        event: React.MouseEvent<HTMLButtonElement>,
        index: number,
    ) => {
        const menu = menus?.[index];
        if (!menu) return;

        const rect = event.currentTarget.getBoundingClientRect();
        openContextMenu({
            x: rect.left,
            y: rect.bottom - 1,
            items: menu.items,
        });
    };

    return (
        <section className={`${styles.windowMenu} flex ${hasWindowsLogo ? "justify-between" : "justify-start"}`} data-minified={isMinified}>
            <div className="relative overflow-hidden w-full">
                <ul className="flex mx-1">
                    {labels.map((item, index) => (
                        <li key={index} className="display-block my-1 px-2.5 py-1" data-interactive={!!menus?.[index]}>
                            <button type="button" onClick={(event) => onMenuClick(event, index)}>{item}</button>
                        </li>
                    ))}
                </ul>
            </div>
            {hasWindowsLogo && <img src="icon__windows_logo.png" height="100%" width="40" />}
        </section>
    );
};

export default WindowMenu;
