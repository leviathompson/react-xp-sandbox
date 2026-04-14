import styles from "./TaskBarNotifications.module.scss";

export interface TaskBarNotificationItem {
    id: number;
    senderId: string;
    senderAvatarSrc: string;
    preview: string;
    dismissed: boolean;
}

interface TaskBarNotificationsProps {
    notifications: TaskBarNotificationItem[];
    onOpen: (notificationId: number) => void;
    onDismiss: (notificationId: number) => void;
}

const TaskBarNotifications = ({ notifications, onOpen, onDismiss }: TaskBarNotificationsProps) => {
    if (!notifications.length) return null;

    return (
        <div className={styles.notificationStack} aria-live="polite" aria-atomic="false">
            {notifications.map((notification) => (
                <article
                    key={notification.id}
                    className={styles.notification}
                    data-dismissed={notification.dismissed ? "true" : "false"}
                >
                    <button
                        type="button"
                        className={styles.openButton}
                        onClick={() => onOpen(notification.id)}
                    >
                        <img src={notification.senderAvatarSrc} alt="" className={styles.avatar} />
                        <div className={styles.content}>
                            <strong>{notification.senderId}</strong>
                            <p title={notification.preview}>{notification.preview}</p>
                        </div>
                    </button>
                    <button
                        type="button"
                        className={styles.dismiss}
                        onClick={() => onDismiss(notification.id)}
                        aria-label={`Dismiss notification from ${notification.senderId}`}
                    >
                        <span>+</span>
                    </button>
                </article>
            ))}
        </div>
    );
};

export default TaskBarNotifications;
