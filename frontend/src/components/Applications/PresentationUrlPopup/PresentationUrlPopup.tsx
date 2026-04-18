import { useEffect, useRef } from "react";
import { useContext } from "../../../context/context";
import { runPresentationSequence } from "../../../utils/presentation";
import styles from "./PresentationUrlPopup.module.scss";

const PresentationUrlPopup = () => {
    const { currentWindows, username, dispatch } = useContext();
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const urlRef = useRef<HTMLParagraphElement | null>(null);

    useEffect(() => {
        const bodyElement = bodyRef.current;
        const urlElement = urlRef.current;
        if (!bodyElement || !urlElement) return;

        const fitUrl = () => {
            urlElement.style.fontSize = "";

            const bodyStyles = window.getComputedStyle(bodyElement);
            const horizontalPadding = (parseFloat(bodyStyles.paddingLeft) || 0) + (parseFloat(bodyStyles.paddingRight) || 0);
            const availableWidth = Math.max(0, bodyElement.clientWidth - horizontalPadding);
            const measuredWidth = urlElement.scrollWidth;
            if (!availableWidth || !measuredWidth) return;

            if (measuredWidth <= availableWidth) return;

            const currentFontSize = parseFloat(window.getComputedStyle(urlElement).fontSize) || 16;
            const nextFontSize = Math.max(1, (currentFontSize * availableWidth / measuredWidth) * 0.98);
            urlElement.style.fontSize = `${nextFontSize}px`;
        };

        fitUrl();

        const resizeObserver = new ResizeObserver(() => {
            fitUrl();
        });

        resizeObserver.observe(bodyElement);
        return () => resizeObserver.disconnect();
    }, []);

    const onContinue = () => {
        const currentUserId = username.trim();
        void runPresentationSequence(currentUserId, currentWindows, dispatch);
    };

    return (
        <div className={styles.popup}>
            <div className={styles.header}>
                <img src="/icon__warning.png" width="32" height="32" alt="" />
                <div>
                    <strong>WARNING</strong>
                    <span>Immediate action required</span>
                </div>
            </div>

            <div ref={bodyRef} className={styles.body}>
                <p className={styles.kicker}>To join, visit</p>
                <p ref={urlRef} className={styles.url}>presentation.levithompson.design</p>
            </div>

            <div className={styles.actions}>
                <button type="button" className={styles.continueButton} onClick={onContinue}>
                    Continue
                </button>
            </div>
        </div>
    );
};

export default PresentationUrlPopup;
