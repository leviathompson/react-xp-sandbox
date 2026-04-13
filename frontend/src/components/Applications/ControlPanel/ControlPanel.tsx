import { useContext } from "../../../context/context";
import { openApplication } from "../../../utils/general";
import CollapseBox from "../../CollapseBox/CollapseBox";
import WindowMenu from "../../WindowMenu/WindowMenu";
import explorerStyles from "../FileExplorer/FileExplorer.module.scss";
import styles from "./ControlPanel.module.scss";

const categories = [
  {
    title: "Appearance and Themes",
    icon: "/icon_style_options--large.png",
  },
  {
    title: "Printers and Other Hardware",
    icon: "/icon__printers_faxes--large.png",
  },
  {
    title: "Network and Internet Connections",
    icon: "/icon__network_places--large.png",
  },
  {
    title: "User Accounts",
    icon: "/icon__switch_users--large.png",
    appId: "userAccounts",
  },
  {
    title: "Add or Remove Programs",
    icon: "/icon__default_programs--large.png",
  },
  {
    title: "Date, Time, Language, and Regional Options",
    icon: "/icon__globe.png",
  },
  {
    title: "Sounds, Speech, and Audio Devices",
    icon: "/icon__music--large.png",
  },
  {
    title: "Accessibility Options",
    icon: "/icon__support--large.png",
  },
  {
    title: "Performance and Maintenance",
    icon: "/icon__refresh--large.png",
  },
  {
    title: "Security Center",
    icon: "/icon__info.png",
  },
];

const seeAlsoLinks = [
  {
    title: "Windows Update",
    icon: "/icon__win_update--large.png",
  },
  {
    title: "Help and Support",
    icon: "/icon__support--large.png",
  },
  {
    title: "Other Control Panel Options",
    icon: "/icon__control_panel--large.png",
  },
];

const ControlPanel = () => {
  const { currentWindows, dispatch } = useContext();

  const onCategoryClick = (appId?: string) => {
    if (!appId) return;
    openApplication(appId, currentWindows, dispatch);
  };

  return (
    <div className={styles.controlPanel}>
      <div className={explorerStyles.menusContainer}>
        <WindowMenu
          menuItems={["File", "Edit", "View", "Favorites", "Tools", "Help"]}
          hasWindowsLogo={true}
        />

        <section className={`${explorerStyles.appMenu} relative`}>
          <div className="flex absolute">
            <div className="flex shrink-0">
              <button
                type="button"
                className="flex items-center m-0.5"
                disabled
              >
                <img
                  className="mr-2"
                  src="/icon__back.png"
                  width="20"
                  height="20"
                />
                <h4>Back</h4>
                <span className="h-full">
                  <span className={explorerStyles.dropdown}>&#9660;</span>
                </span>
              </button>
              <button
                type="button"
                className="flex items-center m-0.5 cursor-not-allowed"
              >
                <img src="/icon__forward.png" width="20" height="20" />
                <h4 className="hidden">Forward</h4>
                <span className="h-full">
                  <span className={explorerStyles.dropdown}>&#9660;</span>
                </span>
              </button>
              <button
                type="button"
                className="flex items-center m-0.5 cursor-not-allowed"
              >
                <img src="/icon__up.png" width="20" height="20" />
                <h4 className="hidden">Up</h4>
              </button>
            </div>

            <div className="flex shrink-0">
              <button
                type="button"
                className="flex items-center m-0.5 cursor-not-allowed"
              >
                <img
                  className="mr-2"
                  src="/icon__search--large.png"
                  width="20"
                  height="20"
                />
                <h4>Search</h4>
              </button>
              <button
                type="button"
                className="flex items-center m-0.5 cursor-not-allowed"
              >
                <img
                  className="mr-2"
                  src="/icon__folders.png"
                  width="20"
                  height="20"
                />
                <h4>Folders</h4>
              </button>
            </div>

            <div className="flex shrink-0">
              <button
                type="button"
                className="flex items-center m-0.5 cursor-not-allowed"
                data-label="views"
              >
                <img src="/icon__views.png" width="20" height="20" />
                <h4 className="hidden">Views</h4>
                <span className="h-full">
                  <span className={explorerStyles.dropdown}>&#9660;</span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className={`${explorerStyles.navMenu} relative`}>
          <div className="w-full h-full flex items-center absolute px-3">
            <span className={`${explorerStyles.navLabel} mr-1`}>Address</span>

            <div className={`${explorerStyles.navBar} flex mx-1 h-full`}>
              <img
                src="/icon__control_panel--large.png"
                className="mx-1"
                width="14"
                height="14"
              />
              <input
                className={`${explorerStyles.navBar} h-full`}
                type="text"
                value="Control Panel"
                readOnly
              />
              <button type="button" className={explorerStyles.dropDown}>
                Submit
              </button>
            </div>

            <button
              type="button"
              className={`${explorerStyles.goButton} flex items-center cursor-not-allowed`}
            >
              <img
                src="/icon__go.png"
                className="mr-1.5"
                width="19"
                height="19"
              />
              <span>Go</span>
            </button>
          </div>
        </section>
      </div>

      <main className={styles.mainContent}>
        <aside className={`${explorerStyles.sidebar} ${styles.sidebar}`}>
          <CollapseBox title="Control Panel">
            <div className={styles.sidebarLinks}>
              <div className={styles.sidebarLink}>
                <img
                  src="/icon__control_panel--large.png"
                  width="16"
                  height="16"
                />
                <span>Switch to Classic View</span>
              </div>
            </div>
          </CollapseBox>

          <CollapseBox title="See Also">
            <div className={styles.sidebarLinks}>
              {seeAlsoLinks.map((link) => (
                <div key={link.title} className={styles.sidebarLink}>
                  <img src={link.icon} width="16" height="16" />
                  <span>{link.title}</span>
                </div>
              ))}
            </div>
          </CollapseBox>
        </aside>

        <section className={styles.contents}>
          <div className={styles.watermark} aria-hidden="true" />

          <div className={styles.inner}>
            <h1>Pick a category</h1>

            <div className={styles.categoryGrid}>
              {categories.map((category) => (
                <button
                  key={category.title}
                  type="button"
                  className={styles.category}
                  data-interactive={!!category.appId}
                  onClick={() => onCategoryClick(category.appId)}
                >
                  <span className={styles.categoryIcon}>
                    <img src={category.icon} width="48" height="48" />
                  </span>
                  <h2>{category.title}</h2>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ControlPanel;
