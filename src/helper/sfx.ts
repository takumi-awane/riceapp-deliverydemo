export enum SoundEffect {
    alert = "alert.ogg",
    charging = "charging.ogg",
    confirm = "confirm.ogg",
    error = "error.ogg",
    horn = "horn.ogg",
    input = "input.ogg",
    lid = "lid.ogg",
    moving = "moving.ogg",
    notify = "notify.ogg",
    thankyou = "thankyou.ogg",
    unlock = "unlock.ogg"
};

export async function playSoundEffect(file: SoundEffect, loop = false, volume = 1) {
    const sfx = new Audio(`/sfx/${file}`);
    sfx.loop = loop;
    sfx.volume = volume;
    await sfx.play();
    return sfx;
}
