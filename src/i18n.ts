import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
    lng: "ja",
    fallbackLng: "en",
    debug: true,
    interpolation: { escapeValue: false }, // Not needed for react
    supportedLngs: ["en", "ja"],
    nonExplicitSupportedLngs: true,
    resources: { // Resource keys loosely follow xstate state keys
        en: {
            translation: {
                init: "Initializing",
                enterPasscode: "Enter password to unlock robot",
                confirmPosition: {
                    selectLoc: "Please select where I'm located",
                    noHome: "No home point found on map",
                    continue: "Continue",
                    overriding: "Adjusting position",
                },
                idle: {
                    delivery: {
                        morning: "Please collect your package",
                        afternoon: "Good Afternoon",
                        evening: "Good Evening",
                        welcome: [
                            "I can make your deliveries,\nno need for any hesitancies.",
                            "For your deliveries,\nlet me be the one with all the efficiencies.",
                            "Don't worry about your dispatches,\nI'll make sure they never meet any clashes.",
                            "Let me be your delivery knight,\nto make sure your packages are always in sight.",
                            "With me as your courier,\nyour deliveries will never be a failure.",
                            "I'll get your packages there in a dash,\nwith no need for any crash.",
                            "No need to stress about your deliveries,\nI'll make sure they're always in the right destinies.",
                            "For your packages,\nlet me be the one with all the savvies.",
                            "I'll transport your goods with all the right moves,\nnothing to lose.",
                            "Let me be your delivery partner,\nto make sure your packages never wander.",
                            "Need a hand with your dispatches?\nI'll make sure they never end in any messes.",
                            "With me as your courier,\nyour deliveries will always be a pleasure.",
                            "For your packages,\nlet me be the one with all the aces.",
                            "Let me be your go-to guy,\nto make sure your deliveries never go awry.",
                            "I'll get your goods from A to B,\nin a jiffy you'll see.",
                            "Need a delivery pro?\nI'll make sure your packages always go.",
                            "For your deliveries,\nlet me be the one with all the efficiencies.",
                            "I'll take on the task,\nto make sure your deliveries are never a mask.",
                            "With me as your courier,\nyour deliveries will always be secure."
                        ],
                        start: "Start delivery",
                        refill: "Open",
                        return: "Return Home"
                    },
                    failedDelivery: {
                        deliveryFailed: "Failed delivery",
                        itemNotCollected: "Item was not collected by customer",
                        clear: "Clear",
                    },
                    disinfection: {
                        next: "Next disinfection",
                        noSched: "No disinfection scheduled",
                        charge: "Charge",
                        refill: "Refill",
                        more: "More",
                        hide: "Hide",
                        quickStart: {
                            wake: "Wake",
                            noName: "No path name"
                        },
                    },
                },
                charging: {
                    delivery: {
                        welcome: "Welcome",
                        waitBattery: "Please wait for battery to charge to {{minBattery}}%",
                    },
                    disinfection: {
                        next: "Next disinfection",
                        noSched: "No disinfection scheduled",
                        waitBattery: "Please wait for battery to charge to {{minBattery}}%",
                        more: "More",
                        hide: "Hide",
                    },
                    skippedDisinfection: {
                        skippedDisinfection: "Skipped Disinfection",
                        insufficient: "Battery or fluid level was insufficient",
                        pathId: "Path ID",
                        rep: "Repetition",
                        clear: "Clear",
                    },
                    docking: "Docking",
                    enterPasscode: "Enter password to return home"
                },
                delivery: {
                    enterPasscodeInit: "Enter password to proceed",
                    enterPasscodeCollect: "Enter the passcode\nsent to you via SMS",
                    placeItems: {
                        lidOpen: "Opening lid",
                        lidClose: "Closing lid",
                        keepClear: "Keep hands clear of moving parts!",
                        itemPlacing: {
                            title: "Please place your items",
                            back: "Back",
                            continue: "Continue",
                        }
                    },
                    configRecipient: {
                        recipient: "Recipient",
                        phone: "Phone number",
                        dest: "Destination",
                        selectDest: "Select destination",
                        noDest: "No delivery destination available",
                        back: "Back",
                        continue: "Continue",
                    },
                    confirmDetails: {
                        title: "Confirm delivery?",
                        subtitle: "Your package will be delivered to the following recipient:",
                        back: "Back",
                        confirm: "Confirm",
                    },
                    delivering: "Delivering to {{dest}}",
                    waitForRecipient: {
                        title: "I have a package for you!",
                        collect: "Collect",
                    },
                    collectItems: {
                        collect: "Please collect your package",
                        complete: "Complete",
                    },
                },
                disinfection: {
                    start: "I'm reporting for duty!",
                    end: "I'm calling it a day!",
                    remain: "Remaining disinfection tasks: {{repetition}}",
                    infinite: "Infinite Loop",
                },
                refill: {
                    title: "Disinfectant Level",
                    warning: "Please fill until at least 25%",
                    return: "Return"
                },
                returnHome: "I'm heading home",
                fatalError: {
                    title: "I'm having some trouble",
                    subtitle: "Please ask staff for assistance",
                },
            },
        },
        ja: {
            translation: {
                init: "初期化中",
                enterPasscode: "パスコード\n「 2357 」\nを入力してください。",
                confirmPosition: {
                    selectLoc: "現在の位置を選択してください。",
                    noHome: "マップ上にホームがありません。",
                    continue: "次へ",
                    overriding: "位置を調整中",
                },
                idle: {
                    delivery: {
                        return: "ホームにもどる",
                        go: "配送開始",
                        charge: "充電する",
                        refill: "ふたを開く",
                        morning: "おはようございます",
                        first: "ボタンを押すと、ホームにもどります",
                        home: "ボタンを押すと、ホームにもどります",
                        afternoon: "こんにちは。",
                        evening: "こんばんは。",
                        welcome: "ボタンを押すと、ホームにもどります",
                        start: "配送開始"
                    },
                    failedDelivery: {
                        deliveryFailed: "配送失敗",
                        itemNotCollected: "配送先で荷物が取り出されませんでした。",
                        clear: "了解",
                    },
                    disinfection: {
                        next: "次の噴霧予定",
                        noSched: "スケジュールされている噴霧タスクはありません。",
                        charge: "充電",
                        refill: "補充",
                        more: "もっと見る",
                        hide: "隠す",
                        quickStart: {
                            wake: "ホームに移動",
                            noName: "経路名がありません。"
                        },
                    },
                },
                charging: {
                    delivery: {
                        welcome: "ようこそ",
                        waitBattery: "バッテリー残量が {{minBattery}}% になるまでお待ちください。",
                    },
                    disinfection: {
                        next: "次の噴霧予定",
                        noSched: "噴霧タスクがスケジュールされていません。",
                        waitBattery: "バッテリー残量が {{minBattery}}% になるまでお待ちください。",
                        more: "もっと見る",
                        hide: "隠す",
                    },
                    skippedDisinfection: {
                        skippedDisinfection: "予定されていた噴霧をスキップしました。",
                        insufficient: "バッテリーまたは液剤の残量が不足しています。",
                        pathId: "経路ID",
                        rep: "繰り返し",
                        clear: "消去",
                    },
                    docking: "ドッキング中",
                    enterPasscode: "パスコードを入力\nしてください。"
                },
                delivery: {
                    enterPasscodeInit: "パスコードを入力\nしてください。",
                    enterPasscodeCollect: "パスコード\n「 2357 」\nを入力してください。",
                    placeItems: {
                        lidOpen: "蓋を開いています。",
                        lidClose: "蓋を閉じています。",
                        keepClear: "蓋の開閉中は手を挟まないように注意してください。",
                        itemPlacing: {
                            title: "配送する荷物を入れてください。",
                            back: "戻る",
                            continue: "次へ",
                        }
                    },
                    configRecipient: {
                        recipient: "受取人",
                        phone: "電話番号",
                        dest: "配送先",
                        selectDest: "配送先を選択",
                        noDest: "配送先がありません。",
                        back: "戻る",
                        continue: "次へ",
                    },
                    confirmDetails: {
                        title: "配送先の確認",
                        subtitle: "荷物は下記の受取人に配送されます。",
                        back: "戻る",
                        confirm: "出発",
                    },
                    delivering: "{{dest}}に配送中",
                    waitForRecipient: {
                        title: "荷物をお持ちしました。",
                        collect: "取り出す",
                    },
                    collectItems: {
                        collect: "荷物を取り出してください。",
                        complete: "完了",
                    },
                },
                disinfection: {
                    start: "噴霧に出発します。",
                    end: "噴霧を終了します。",
                    remain: "残りの噴霧回数: {{repetition}}",
                    infinite: "無限ループ",
                },
                refill: {
                    title: "ノベルティをお受け取りください",
                    input: "配送する荷物を入れてください",
                    warning: "最低でも25%まで補充してください。",
                    return: "ふたを閉める"
                },
                returnHome: "ホームに移動中",
                fatalError: {
                    title: "何らかの不具合が発生しました。",
                    subtitle: "スタッフにお問い合わせください。",
                },
            },
        },
    }
});

export default i18n;