import {
    checkForMidPatchUpdates,
    scrapeArticleData,
    extractMidPatchUpdatesDates,
    extractTimestamp,
    generateFinalOutput,
} from "./webScraper";
const fs = require("fs");

async function main() {
    const patchNotesUrl =
        "https://www.leagueoflegends.com/en-us/news/tags/teamfight-tactics-patch-notes/";

    console.log("----- Running scrapeArticleData -----");
    const scrapedData = await scrapeArticleData(patchNotesUrl);
    console.log("Scraped Data:", scrapedData);

    // Replace the specificPatchUrl with the first URL from the scrapedData array
    const firstPatchData = scrapedData[0];

    console.log("\n----- Running checkForMidPatchUpdates -----");
    const isMidPatchUpdate = await checkForMidPatchUpdates(firstPatchData.url);
    console.log("Mid-Patch Updates present:", isMidPatchUpdate);

    let updatesDates = [];

    if (isMidPatchUpdate) {
        console.log("\n----- Running extractMidPatchUpdatesDates -----");
        updatesDates = await extractMidPatchUpdatesDates(firstPatchData.url);
        console.log("Mid-Patch Updates Dates:", updatesDates);
    } else {
        console.log("No Mid-Patch Updates found.");
    }

    console.log("\n----- Running extractTimestamp-----");
    const timestamp = await extractTimestamp(firstPatchData.url);
    console.log("Timestamp:", timestamp);

    console.log("\n----- Generating final output -----");
    const finalOutput = await generateFinalOutput(
        firstPatchData,
        isMidPatchUpdate,
        updatesDates,
        timestamp
    );
    console.log("Final Output:");
    console.log(finalOutput);

    // Write the final output to a file
    console.log(
        "\n----- Writing final output to outputs/patch_version.json -----"
    );
    fs.writeFile(
        "patch_version.json",
        JSON.stringify(finalOutput, null, 2),
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
}

main();
