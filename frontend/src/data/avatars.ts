export const DEFAULT_AVATAR_SRC = "/avatar__skateboard.png";

const avatarFiles = [
    "airplane",
    "astronaut",
    "ball",
    "beach_chairs",
    "butterfly",
    "car",
    "cat",
    "chess_pieces",
    "dirt_bike",
    "drip",
    "fish",
    "friendly_dog",
    "frog",
    "guest",
    "guitar",
    "kick",
    "orange_daisy",
    "palm_trees",
    "pink_flower",
    "rocket_launch",
    "rubber_ducky",
    "running_horses",
    "skateboard",
    "snowflake",
    "soccer_ball",
] as const;

const toLabel = (slug: string) => slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const avatarOptions = avatarFiles.map((file) => ({
    id: file,
    label: toLabel(file),
    src: `/avatar__${file}.png`,
}));
