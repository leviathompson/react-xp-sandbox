import { useEffect } from "react";
import { useContext } from "../../context/context";
import styles from "./Bsod.module.scss";

const Bsod = () => {
    const { dispatch } = useContext();

    useEffect(() => {
        const restart = () => window.location.reload();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") restart();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [dispatch]);

    return (
        <div className={styles.bsod} onClick={() => window.location.reload()}>
            <div className={styles.content}>
                <p>A problem has been detected and Windows has been shut down to prevent damage</p>
                <p>to your computer.</p>

                <p className={styles.errorName}>UNMOUNTABLE_BOOT_VOLUME</p>

                <p>If this is the first time you've seen this error screen,</p>
                <p>restart your computer. If this screen appears again, follow</p>
                <p>these steps:</p>

                <p>Check to make sure any new hardware or software is properly installed.</p>
                <p>If this is a new installation, ask your hardware or software manufacturer</p>
                <p>for any Windows updates you might need.</p>

                <p>If problems continue, disable or remove any newly installed hardware</p>
                <p>or software. Disable BIOS memory options such as caching or shadowing.</p>
                <p>If you need to use Safe Mode to remove or disable components, restart</p>
                <p>your computer, press F8 to select Advanced Startup Options, and then</p>
                <p>select Safe Mode.</p>

                <p className={styles.technical}>Technical information:</p>

                <p>*** STOP: 0x000000ED (0x80F128D0, 0xC000009C, 0x00000000, 0x00000000)</p>
            </div>
        </div>
    );
};

export default Bsod;
