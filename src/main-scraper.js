import fs from "fs";
import {
    checkForMidPatchUpdates,
    scrapeArticleData,
    extractMidPatchUpdatesDates,
    extractTimestamp,
    generateFinalOutput,
} from "./webScraper.js";

async function main() {
    const patchNotesUrl =
        "https://www.leagueoflegends.com/en-us/news/tags/teamfight-tactics-patch-notes/";

    console.log("----- Running scrapeArticleData -----");
    const scrapedData = await scrapeArticleData(patchNotesUrl);
    console.log("Scraped Data:", scrapedData);

    if (scrapedData.length === 0) {
        console.log("No data found. Exiting.");
        return;
    }

    const patchData = scrapedData[0];
    const wwwUrl = patchData.url;
    const tftUrl = patchData.url.replace(
        "https://www.",
        "https://teamfighttactics."
    );

    const [wwwOutput, tftOutput] = await Promise.all([
        generateFinalOutput(
            { ...patchData, url: wwwUrl },
            await checkForMidPatchUpdates(wwwUrl),
            await extractMidPatchUpdatesDates(wwwUrl),
            await extractTimestamp(wwwUrl)
        ),
        generateFinalOutput(
            { ...patchData, url: tftUrl },
            await checkForMidPatchUpdates(tftUrl),
            await extractMidPatchUpdatesDates(tftUrl),
            await extractTimestamp(tftUrl)
        ),
    ]);

    const maxPatchData =
        compareVersions(wwwOutput.patchVersion, tftOutput.patchVersion) >= 0
            ? wwwOutput
            : tftOutput;

    console.log("Max Patch Data:", maxPatchData);

    // Read the existing patch_version.json file (if it exists)
    let existingOutput = null;
    try {
        existingOutput = JSON.parse(
            fs.readFileSync("patch_version.json", "utf8")
        );
    } catch (err) {
        console.log("No existing patch_version.json found.");
    }

    // Compare the relevant values
    const shouldWriteToFile =
        !existingOutput ||
        maxPatchData.title !== existingOutput.title ||
        maxPatchData.url !== existingOutput.url ||
        maxPatchData.epoch !== existingOutput.epoch ||
        JSON.stringify(maxPatchData.midPatchUpdateDates) !==
            JSON.stringify(existingOutput.midPatchUpdateDates);

    if (shouldWriteToFile) {
        console.log(
            "\n----- Writing final output to outputs/patch_version.json -----"
        );
        fs.writeFile(
            "patch_version.json",
            JSON.stringify(maxPatchData, null, 2),
            (err) => {
                if (err) {
                    console.error("Error writing to file:", err);
                } else {
                    console.log(
                        "Successfully written to outputs/patch_version.json"
                    );
                }
            }
        );
    } else {
        console.log(
            "\n----- Final output matches existing data, skipping file write -----"
        );
    }
}
function compareVersions(v1, v2) {
    const v1Parts = v1.match(/\d+|\D+/g);
    const v2Parts = v2.match(/\d+|\D+/g);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const p1 = v1Parts[i];
        const p2 = v2Parts[i];

        if (/^\d+$/.test(p1) && /^\d+$/.test(p2)) {
            const n1 = parseInt(p1);
            const n2 = parseInt(p2);
            if (n1 !== n2) {
                return n1 > n2 ? 1 : -1;
            }
        } else if (p1 !== p2) {
            return p1 < p2 ? 1 : -1;
        }
    }

    return 0;
}

main();
