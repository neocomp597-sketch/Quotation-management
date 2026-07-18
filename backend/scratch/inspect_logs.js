const fs = require('fs');
const readline = require('readline');

async function main() {
    const fileStream = fs.createReadStream('C:/Users/wagho/.gemini/antigravity-ide/brain/5f2198a0-a2da-46df-a344-1922645dfcdc/.system_generated/logs/transcript.jsonl');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.includes('renderPlanning')) {
            console.log('Found line matching renderPlanning!');
            // Print a snippet of the line
            console.log(line.slice(0, 1000));
            console.log('---');
        }
    }
}

main().catch(console.error);
