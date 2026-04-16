import WindowMenu from "../../WindowMenu/WindowMenu";
import styles from "./Notepad.module.scss";

interface NotepadProps {
    appId?: string;
    title: string;
    content: string;
}

const Notepad = ({ appId, content }: NotepadProps) => {
    return (
        <div className={`${styles.notepad} flex flex-col h-full`}>
            <WindowMenu menuItems={["File", "Edit", "Format", "View", "Help"]}/>
            <textarea className="py-1 px-2" data-notepad-app-id={appId} defaultValue={content}></textarea>
        </div>
    );
};

export default Notepad;
