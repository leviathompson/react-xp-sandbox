import { useRef, useState } from "react";
import { useContext } from "../../../context/context";
import applicationsJSON from "../../../data/applications.json";
import { resetCryptoWalletDoomsday, startCryptoWalletDoomsday } from "../../../utils/cryptoWallet";
import { openApplication } from "../../../utils/general";
import { generateUniqueId } from "../../../utils/general";
import Button from "../../Button/Button";
import styles from "./Run.module.scss";
import type { Application } from "../../../context/types";
import type { currentWindow } from "../../../context/types";

const Applications = applicationsJSON as unknown as Record<string, Application>;
const runAdminCommand = async (path: string) => {
    await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    });
};

const Run = () => {
    const { currentWindows, dispatch } = useContext();
    const inputFieldRef = useRef<HTMLInputElement | null>(null);
    const inputField = inputFieldRef.current;

    const [isOkayDisabled, setIsOkayDisabled] = useState(true);

    const onInputHandler = () => {
        setIsOkayDisabled((inputField?.value.length === 0));
    };

    const closeWindow = () => {
        dispatch({type: "SET_CURRENT_WINDOWS", payload: currentWindows.filter((item) => item.appId !== "run")});
    };

    const onSubmitHandler = (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const inputField = form.elements.namedItem("command") as HTMLInputElement;
        const command = inputField.value.trim();
        const normalizedCommand = command.toLowerCase();

        const closeRunWindow = () => {
            dispatch({ type: "SET_CURRENT_WINDOWS", payload: currentWindows.filter((item) => item.appId !== "run") });
        };

        const startTimerMatch = normalizedCommand.match(/^%starttimer(\d+)%$/);
        if (startTimerMatch) {
            const minutes = Number(startTimerMatch[1]);
            void startCryptoWalletDoomsday(minutes);
            closeRunWindow();
            return;
        }

        if (normalizedCommand === "%resettimer%") {
            void resetCryptoWalletDoomsday();
            closeRunWindow();
            return;
        }

        if (normalizedCommand === "%nuke%") {
            void runAdminCommand("/api/admin/nuke");
            closeRunWindow();
            return;
        }

        if (normalizedCommand === "%appdata%") {
            openApplication("roamingFolder", currentWindows, dispatch);
            return;
        }

        if (command.startsWith("http")) {
            const newWindow: currentWindow = {
                id: generateUniqueId(),
                appId: "internetExplorer",
                active: true,
                history: [],
                forward: [],
                landingUrl: command
            };
            
            const updatedCurrentWindows = currentWindows.filter((item) => item.appId !== "run");
            updatedCurrentWindows.push(newWindow);

            dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
            return;
        };


        if (command in Applications) {
            openApplication(command, currentWindows, dispatch);
            return;
        }

        const appId = Object.entries(Applications).find(([, item]) => item.title.toLowerCase() === normalizedCommand)?.[0];
        if (appId && !Applications[appId].disabled && !Applications[appId].link) {
            openApplication(appId, currentWindows, dispatch);
        } 
    };

    return (
        <form className={`${styles.run} py-5 px-4 h-full flex flex-col justify-between`} onSubmit={onSubmitHandler}>
            <div>
                <div className="flex">
                    <img className="mr-4" src="/icon__run--large.png" width="30" height="30" />
                    <p>Type the name of a program, folder, document, or Internet Resource, and Windows will open it for you.</p>
                </div>
                <div className="flex my-5">
                    <span className={`${styles.inputLabel} mr-2`}>Open:</span>
                    <div className={`${styles.inputField} flex mx-1 h-full`}>
                        <input name="command" autoFocus ref={inputFieldRef} className={`${styles.input} h-full w-full p-1`} type="text" onInput={onInputHandler} />
                        <span className={styles.dropDown}></span>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
                <Button type="submit" disabled={isOkayDisabled}>Ok</Button>
                <Button onClick={closeWindow}>Cancel</Button>
                <Button disabled>Browse</Button>
            </div>
        </form>
    );
};

export default Run;
