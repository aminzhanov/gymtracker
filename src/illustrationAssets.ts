import type { ProfileIllustration } from "./types";
import image0 from "./assets/cat-face.webp";
import image1 from "./assets/cat-back.webp";
import image2 from "./assets/sticker.webp";
import image3 from "./assets/sticker2.webp";
import image4 from "./assets/sticker3.webp";
import image5 from "./assets/sticker4.webp";
import image6 from "./assets/5.webp";
import image7 from "./assets/sticker6.webp";
import image8 from "./assets/sticker7.webp";
import image9 from "./assets/sticker8.webp";
import image10 from "./assets/sticker9.webp";
import image11 from "./assets/sticker10.webp";
import image12 from "./assets/sticker11.webp";
import image13 from "./assets/sticker12.webp";
import image14 from "./assets/sticker13.webp";
import image15 from "./assets/sticker15.webp";
import image16 from "./assets/sticker17.webp";
import image17 from "./assets/sticker18.webp";
import image18 from "./assets/sticker19.webp";
import image19 from "./assets/sticker20.webp";
import image20 from "./assets/sticker21.webp";

export const ILLUSTRATION_PRESETS = [
  { id: "cat-face", name: "Cat face", src: image0 },
  { id: "cat-back", name: "Cat back", src: image1 },
  { id: "sticker", name: "Cat 1", src: image2 },
  { id: "sticker2", name: "Cat 2", src: image3 },
  { id: "sticker3", name: "Cat 3", src: image4 },
  { id: "sticker4", name: "Cat 4", src: image5 },
  { id: "5", name: "Cat 5", src: image6 },
  { id: "sticker6", name: "Cat 6", src: image7 },
  { id: "sticker7", name: "Cat 7", src: image8 },
  { id: "sticker8", name: "Cat 8", src: image9 },
  { id: "sticker9", name: "Cat 9", src: image10 },
  { id: "sticker10", name: "Cat 10", src: image11 },
  { id: "sticker11", name: "Cat 11", src: image12 },
  { id: "sticker12", name: "Cat 12", src: image13 },
  { id: "sticker13", name: "Cat 13", src: image14 },
  { id: "sticker15", name: "Cat 14", src: image15 },
  { id: "sticker17", name: "Cat 15", src: image16 },
  { id: "sticker18", name: "Cat 16", src: image17 },
  { id: "sticker19", name: "Cat 17", src: image18 },
  { id: "sticker20", name: "Cat 18", src: image19 },
  { id: "sticker21", name: "Cat 19", src: image20 },
];
export function illustrationSource(
  item: ProfileIllustration,
  fallback: string,
) {
  return (
    item.image ||
    ILLUSTRATION_PRESETS.find((p) => p.id === item.preset)?.src ||
    fallback
  );
}
