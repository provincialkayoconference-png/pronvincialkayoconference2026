const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");
dotenv.config();

const app = express();

// ============================================
// SESSION CONFIGURATION
// ============================================

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8
        }
    })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Test database connection
pool.connect()
    .then(client => {
        console.log("Connected to PostgreSQL");
        client.release();
    })
    .catch(error => {
        console.error("Database connection error:", error.message);
    });

// ============================================
// TEST API
// ============================================
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Provincial Kayo Conference 2026 API is working"
    });
});

// ============================================
// GET DIOCESES
// ============================================
app.get("/api/dioceses", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name FROM dioceses ORDER BY name ASC"
        );

        res.json({
            success: true,
            dioceses: result.rows
        });
    } catch (error) {
        console.error("Error fetching dioceses:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load dioceses"
        });
    }
});

// ============================================
// CREATE REGISTRATION
// ============================================
app.post("/api/registrations", async (req, res) => {
    try {
        const {
            full_name,
            diocese_id,
            gender,
            payment_method,
            cash_amount,
            mpesa_code,
            cheque_number,
            bank_reference
        } = req.body;

        // Validate required fields
        if (!full_name || !diocese_id || !gender || !payment_method) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields"
            });
        }

        // Normalize values
        const cleanName = full_name.trim();
        const cleanGender = gender.toUpperCase();
        const cleanPaymentMethod = payment_method.toUpperCase();

        // Validate gender
        if (!["MALE", "FEMALE"].includes(cleanGender)) {
            return res.status(400).json({
                success: false,
                message: "Invalid gender"
            });
        }

        // Validate payment method
        // ============================================
// VALIDATE PAYMENT METHOD
// ============================================

if (![
    "MPESA",
    "CASH",
    "CHEQUE",
    "BANK_TRANSFER"
].includes(cleanPaymentMethod)) {

    return res.status(400).json({
        success: false,
        message: "Invalid payment method"
    });
}


// ============================================
// VALIDATE PAYMENT DETAILS
// ============================================

let paymentReference = null;
let amountReceived = null;


// CASH
if (cleanPaymentMethod === "CASH") {

    if (
        !cash_amount ||
        Number(cash_amount) <= 0
    ) {

        return res.status(400).json({
            success: false,
            message: "Please enter the amount paid in cash."
        });

    }

    amountReceived =
        Number(cash_amount);
}


// MPESA
if (cleanPaymentMethod === "MPESA") {

    if (
        !mpesa_code ||
        !mpesa_code.trim()
    ) {

        return res.status(400).json({
            success: false,
            message: "Please enter the M-Pesa transaction code."
        });

    }

    paymentReference =
        mpesa_code.trim().toUpperCase();
}


// CHEQUE
if (cleanPaymentMethod === "CHEQUE") {

    if (
        !cheque_number ||
        !cheque_number.trim()
    ) {

        return res.status(400).json({
            success: false,
            message: "Please enter the cheque number."
        });

    }

    paymentReference =
        cheque_number.trim();
}


// BANK
if (cleanPaymentMethod === "BANK_TRANSFER") {

    if (
        !bank_reference ||
        !bank_reference.trim()
    ) {

        return res.status(400).json({
            success: false,
            message: "Please enter the bank transaction/deposit reference."
        });

    }

    paymentReference =
        bank_reference.trim();
}

        // Check whether diocese exists
        const dioceseCheck = await pool.query(
            "SELECT id, name FROM dioceses WHERE id = $1",
            [diocese_id]
        );

        if (dioceseCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Selected diocese does not exist"
            });
        }

        // Duplicate detection:
        // Same full name + same diocese
        const duplicateCheck = await pool.query(
            `SELECT registration_no, full_name
             FROM registrations
             WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
             AND diocese_id = $2`,
            [cleanName, diocese_id]
        );

        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This person is already registered under the selected diocese",
                registration_no: duplicateCheck.rows[0].registration_no
            });
        }

        // Generate the next registration number
       // ============================================
// GENERATE UNIQUE REGISTRATION NUMBER
// ============================================

const sequenceResult = await pool.query(
    "SELECT nextval('registration_number_seq') AS number"
);

const nextNumber =
    sequenceResult.rows[0].number;

const registrationNo =
    `ACK26-${String(nextNumber).padStart(4, "0")}`;

        // Insert registration
        const insertResult = await pool.query(
            `INSERT INTO registrations
            (
                registration_no,
                full_name,
                diocese_id,
                gender,
                payment_method,
                payment_status,
                payment_reference,
                amount_received
            )
            VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)
            RETURNING *`,
            [
                registrationNo,
                cleanName,
                diocese_id,
                cleanGender,
                cleanPaymentMethod,
                paymentReference,
                amountReceived
            ]
        );

        const registration = insertResult.rows[0];

        res.status(201).json({
            success: true,
            message: "Registration successful",
            registration: {
                registration_no: registration.registration_no,
                full_name: registration.full_name,
                diocese: dioceseCheck.rows[0].name,
                gender: registration.gender,
                payment_method: registration.payment_method,
                payment_status: registration.payment_status
            }
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    }
});
// ============================================
// ADMIN - GET REGISTRATIONS
// ============================================
app.get("/api/admin/registrations", requireAdmin, async (req, res) => {

    try {

        const {
            search,
            diocese,
            gender,
            payment_method,
            payment_status
        } = req.query;


        let query = `
            SELECT
                r.id,
                r.registration_no,
                r.full_name,
                r.gender,
                r.payment_method,
                r.payment_status,
                r.payment_reference,
                r.amount_received,
                r.created_at,
                d.name AS diocese
            FROM registrations r
            JOIN dioceses d
                ON r.diocese_id = d.id
            WHERE 1 = 1
        `;


        const values = [];


        if (search) {

            values.push(`%${search}%`);

            query += `
                AND r.full_name ILIKE $${values.length}
            `;
        }


        if (diocese) {

            values.push(diocese);

            query += `
                AND r.diocese_id = $${values.length}
            `;
        }


        if (gender) {

            values.push(gender);

            query += `
                AND r.gender = $${values.length}
            `;
        }


        if (payment_method) {

            values.push(payment_method);

            query += `
                AND r.payment_method = $${values.length}
            `;
        }


        if (payment_status) {

            values.push(payment_status);

            query += `
                AND r.payment_status = $${values.length}
            `;
        }


        query += `
            ORDER BY r.id DESC
        `;


        const result =
            await pool.query(
                query,
                values
            );


        res.json({
            success: true,
            registrations: result.rows
        });


    } catch (error) {

        console.error(
            "Admin registrations error:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Failed to load registrations"
        });
    }

});


// ============================================
// ADMIN - STATISTICS
// ============================================
app.get("/api/admin/statistics", requireAdmin, async (req, res) => {

    try {

        const total =
            await pool.query(
                "SELECT COUNT(*) FROM registrations"
            );


        const male =
            await pool.query(
                `SELECT COUNT(*)
                 FROM registrations
                 WHERE gender = 'MALE'`
            );


        const female =
            await pool.query(
                `SELECT COUNT(*)
                 FROM registrations
                 WHERE gender = 'FEMALE'`
            );


        const pending =
            await pool.query(
                `SELECT COUNT(*)
                 FROM registrations
                 WHERE payment_status = 'PENDING'`
            );


        const byDiocese =
            await pool.query(
                `SELECT
                    d.name AS diocese,
                    COUNT(r.id) AS total
                 FROM dioceses d
                 LEFT JOIN registrations r
                    ON d.id = r.diocese_id
                 GROUP BY d.id, d.name
                 ORDER BY total DESC, d.name ASC`
            );


        res.json({

            success: true,

            statistics: {

                total:
                    Number(total.rows[0].count),

                male:
                    Number(male.rows[0].count),

                female:
                    Number(female.rows[0].count),

                pending:
                    Number(pending.rows[0].count),

                byDiocese:
                    byDiocese.rows
            }

        });


    } catch (error) {

        console.error(
            "Statistics error:",
            error
        );


        res.status(500).json({
            success: false,
            message: "Failed to load statistics"
        });

    }

});


// ============================================
// ADMIN - MARK PAYMENT AS PAID
// ============================================
app.patch(
    "/api/admin/registrations/:id/payment",
    requireAdmin,
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const result =
                await pool.query(
                    `UPDATE registrations
                     SET payment_status = 'PAID'
                     WHERE id = $1
                     RETURNING *`,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Registration not found"

                });

            }


            res.json({

                success: true,

                message:
                    "Payment marked as paid"

            });


        } catch (error) {

            console.error(
                "Payment update error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to update payment"

            });

        }

    }
);


// ============================================
// ADMIN - DELETE REGISTRATION
// ============================================
app.delete(
    "/api/admin/registrations/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const { id } =
                req.params;


            const result =
                await pool.query(
                    `DELETE FROM registrations
                     WHERE id = $1
                     RETURNING registration_no`,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Registration not found"

                });

            }


            res.json({

                success: true,

                message:
                    "Registration deleted"

            });


        } catch (error) {

            console.error(
                "Delete error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to delete registration"

            });

        }

    }
);
// ============================================
// ADMIN - EXPORT EXCEL
// ============================================
app.get("/api/admin/export",
    requireAdmin,
    async (req, res) => {

    try {

        const {
            diocese
        } = req.query;


        let query = `
            SELECT
                r.registration_no,
                r.full_name,
                d.name AS diocese,
                r.gender,
                r.payment_method,
                r.payment_reference,
                r.amount_received,
                r.payment_status,
                r.created_at
            FROM registrations r
            JOIN dioceses d
                ON r.diocese_id = d.id
        `;


        const values = [];


        // Export selected diocese only
        if (diocese) {

            query += `
                WHERE r.diocese_id = $1
            `;

            values.push(diocese);
        }


        query += `
            ORDER BY r.id ASC
        `;


        const result =
            await pool.query(
                query,
                values
            );


        // ====================================
        // CREATE EXCEL WORKBOOK
        // ====================================

        const workbook =
            new ExcelJS.Workbook();


        const worksheet =
            workbook.addWorksheet(
                "Registrations"
            );


        // ====================================
        // TITLE
        // ====================================

        worksheet.mergeCells(
            "A1:G1"
        );

        worksheet.getCell(
            "A1"
        ).value =
            "PROVINCIAL KAYO CONFERENCE 2026 - REGISTRATIONS";


        worksheet.getCell(
            "A1"
        ).font = {
            bold: true,
            size: 18
        };


        worksheet.getCell(
            "A1"
        ).alignment = {
            horizontal: "center"
        };


        // ====================================
        // HEADERS
        // ====================================

        worksheet.addRow([
            "Registration No.",
            "Full Name",
            "Diocese",
            "Gender",
            "Payment Method",
            "Payment Reference",
            "Amount Received",
            "Payment Status",
            "Registration Date"
        ]);


        const header =
            worksheet.getRow(2);


        header.font = {
            bold: true
        };


        header.alignment = {
            horizontal: "center"
        };


        // ====================================
        // DATA
        // ====================================

        result.rows.forEach(row => {

            worksheet.addRow([

                row.registration_no,

                row.full_name,

                row.diocese,

                row.gender,

                formatPaymentMethod(
                    row.payment_method
                ),

                row.payment_status,

                new Date(
                    row.created_at
                ).toLocaleString()

            ]);

        });


        // ====================================
        // COLUMN WIDTHS
        // ====================================

        worksheet.columns = [

            {
                width: 20
            },

            {
                width: 30
            },

            {
                width: 25
            },

            {
                width: 15
            },

            {
                width: 20
            },

            {
                width: 20
            },

            {
                width: 25
            }

        ];


        // ====================================
        // FREEZE HEADER
        // ====================================

        worksheet.views = [
            {
                state: "frozen",
                ySplit: 2
            }
        ];


        // ====================================
        // FILE NAME
        // ====================================

        let fileName =
            "Provincial_kayo_conference-Registrations.xlsx";


        if (diocese) {

            const dioceseResult =
                await pool.query(
                    "SELECT name FROM dioceses WHERE id = $1",
                    [diocese]
                );


            if (
                dioceseResult.rows.length > 0
            ) {

                const cleanName =
                    dioceseResult.rows[0].name
                        .replace(
                            /[^a-zA-Z0-9]+/g,
                            "-"
                        );


                fileName =
                    `${cleanName}-Registrations.xlsx`;
            }

        }


        // ====================================
        // RESPONSE
        // ====================================

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );


        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"`
        );


        await workbook.xlsx.write(res);

        res.end();


    } catch (error) {

        console.error(
            "Excel export error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Failed to export registrations"

        });

    }

});


// ============================================
// FORMAT PAYMENT METHOD
// ============================================
function formatPaymentMethod(method) {

    if (method === "MPESA")
        return "M-Pesa";

    if (method === "CASH")
        return "Cash";

    if (method === "CHEQUE")
        return "Cheque";

    return method;

}
// ============================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ============================================

function requireAdmin(req, res, next) {

    if (
        req.session &&
        req.session.admin
    ) {

        return next();

    }


    return res.status(401).json({

        success: false,

        message:
            "Administrator authentication required"

    });

}
// ============================================
// ADMIN LOGIN
// ============================================

app.post("/api/admin/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        if (!username || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Username and password are required"

            });

        }


        const result =
            await pool.query(
                `SELECT *
                 FROM admin_users
                 WHERE username = $1`,
                [username]
            );


        if (result.rows.length === 0) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid username or password"

            });

        }


        const admin =
            result.rows[0];


        const passwordMatch =
            await bcrypt.compare(
                password,
                admin.password_hash
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid username or password"

            });

        }


        req.session.admin = {

            id: admin.id,

            username: admin.username

        };


        res.json({

            success: true,

            message:
                "Login successful"

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Login failed"

        });

    }

});
// ============================================
// ADMIN LOGOUT
// ============================================

app.post("/api/admin/logout", (req, res) => {

    req.session.destroy(error => {

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Logout failed"

            });

        }


        res.json({

            success: true,

            message:
                "Logged out successfully"

        });

    });

});
// ============================================
// SERVER
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Provincial Kayo Conference 2026 API running on http://localhost:${PORT}`
    );
});