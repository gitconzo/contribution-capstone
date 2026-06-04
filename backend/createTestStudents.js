const {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminGetUserCommand,
    AdminUpdateUserAttributesCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
require("dotenv").config();

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const TEST_PASSWORD = "Testing123123!";

const TEST_STUDENTS = [
    { name: "S1", email: "s1@test.com" },
    { name: "S2", email: "s2@test.com" },
    { name: "S3", email: "s3@test.com" },
    { name: "S4", email: "s4@test.com" },
    { name: "S5", email: "s5@test.com" },
    { name: "S6", email: "s6@test.com" },
    { name: "S7", email: "s7@test.com" },
];

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

async function userExists(email) {
    try {
        await client.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }));
        return true;
    } catch (err) {
        if (err.name === "UserNotFoundException") return false;
        throw err;
    }
}

async function createTestStudent(name, email) {
    const safeEmail = normalizeEmail(email);
    const exists = await userExists(safeEmail);

    const userAttributes = [
        { Name: "email", Value: safeEmail },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: name },
        { Name: "custom:role", Value: "student" },
    ];

    if (!exists) {
        await client.send(new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: safeEmail,
            MessageAction: "SUPPRESS",
            UserAttributes: userAttributes,
        }));
    } else {
        await client.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: safeEmail,
            UserAttributes: userAttributes,
        }));
    }

    await client.send(new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: safeEmail,
        Password: TEST_PASSWORD,
        Permanent: true,
    }));

    return { created: !exists };
}

async function main() {
    for (const { name, email } of TEST_STUDENTS) {
        try {
            const { created } = await createTestStudent(name, email);
            console.log(`${name} (${email}): ${created ? "created" : "updated"}`);
        } catch (err) {
            console.error(`${name} (${email}): FAILED — ${err.message}`);
        }
    }
    console.log(`\nAll test students use password: ${TEST_PASSWORD}`);
}

main().catch(err => console.error("Script failed:", err));
