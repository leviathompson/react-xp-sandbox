import type { Application } from "../context/types";

export const getThumbnailIconSrc = (application?: Application) => {
    if (!application) return "";

    if (application.component === "Paint" && application.assetSrc) {
        return application.assetSrc;
    }

    return application.iconLarge || application.icon || application.assetSrc || "";
};
