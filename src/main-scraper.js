import fs from "fs";
import {
    checkForMidPatchUpdates,
    scrapeArticleData,
    extractMidPatchUpdatesDates,
    extractTimestamp,
    generateFinalOutput,
} from "./webScraper.js";

async function main() {
    const patchNotesUrls = [
        "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/",
        // "https://www.leagueoflegends.com/en-us/news/game-updates/",
    ];

    console.log("----- Running scrapeArticleData -----");
    const scrapedData = await scrapeArticleData(patchNotesUrls);
    console.log("Scraped Data:", scrapedData);

    if (scrapedData.length === 0) {
        console.log("No data found. Exiting.");
        return;
    }

    const outputs = await Promise.all(
        scrapedData.map(async (article) => {
            const isMidPatchUpdate = await checkForMidPatchUpdates(article.url);
            const extractedDates = await extractMidPatchUpdatesDates(
                article.url
            );
            const timestamp = await extractTimestamp(article.url);

            return generateFinalOutput(
                article,
                isMidPatchUpdate,
                extractedDates,
                timestamp
            );
        })
    );

    // Find the output with the highest patch version
    const maxPatchData = outputs.reduce((max, output) =>
        compareVersions(output.patchVersion, max.patchVersion) > 0
            ? output
            : max
    );

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
        console.log("\n----- Writing final output to patch_version.json -----");
        fs.writeFile(
            "patch_version.json",
            JSON.stringify(maxPatchData, null, 2),
            (err) => {
                if (err) {
                    console.error("Error writing to file:", err);
                } else {
                    console.log("Successfully written to patch_version.json");
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
