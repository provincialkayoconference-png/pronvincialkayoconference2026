let registrations = [];


// ============================================
// LOAD DIOCESES
// ============================================
async function loadDioceses() {

    try {

        const response =
            await fetch("/api/dioceses");

        const data =
            await response.json();


        if (!data.success) {
            throw new Error(
                "Failed to load dioceses"
            );
        }


        const filter =
            document.getElementById(
                "filterDiocese"
            );

        const exportSelect =
            document.getElementById(
                "exportDiocese"
            );


        data.dioceses.forEach(diocese => {

            const option =
                document.createElement("option");

            option.value =
                diocese.id;

            option.textContent =
                diocese.name;


            filter.appendChild(
                option.cloneNode(true)
            );

            exportSelect.appendChild(
                option
            );

        });


    } catch (error) {

        console.error(
            "Diocese loading error:",
            error
        );

    }

}


// ============================================
// LOAD STATISTICS
// ============================================
async function loadStatistics() {

    try {

        const response =
            await fetch(
                "/api/admin/statistics"
            );

        const data =
            await response.json();


        if (!data.success) {
            return;
        }


        const stats =
            data.statistics;


        document.getElementById(
            "totalRegistrations"
        ).textContent =
            stats.total;


        document.getElementById(
            "totalMale"
        ).textContent =
            stats.male;


        document.getElementById(
            "totalFemale"
        ).textContent =
            stats.female;


        document.getElementById(
            "pendingPayments"
        ).textContent =
            stats.pending;


        renderDioceseSummary(
            stats.byDiocese
        );


    } catch (error) {

        console.error(
            "Statistics error:",
            error
        );

    }

}


// ============================================
// DIOCESE SUMMARY
// ============================================
function renderDioceseSummary(data) {

    const container =
        document.getElementById(
            "dioceseSummary"
        );


    container.innerHTML = "";


    data.forEach(item => {

        const card =
            document.createElement("div");

        card.className =
            "diocese-card";


        card.innerHTML = `

            <h3>
                ${item.diocese}
            </h3>

            <div class="diocese-total">
                ${item.total}
            </div>

            <small>
                registrations
            </small>

        `;


        container.appendChild(card);

    });

}


// ============================================
// LOAD REGISTRATIONS
// ============================================
async function loadRegistrations() {

    try {

        const params =
            new URLSearchParams();


        const search =
            document.getElementById(
                "searchName"
            ).value.trim();


        const diocese =
            document.getElementById(
                "filterDiocese"
            ).value;


        const gender =
            document.getElementById(
                "filterGender"
            ).value;


        const paymentMethod =
            document.getElementById(
                "filterPaymentMethod"
            ).value;


        const paymentStatus =
            document.getElementById(
                "filterPaymentStatus"
            ).value;


        if (search)
            params.append(
                "search",
                search
            );


        if (diocese)
            params.append(
                "diocese",
                diocese
            );


        if (gender)
            params.append(
                "gender",
                gender
            );


        if (paymentMethod)
            params.append(
                "payment_method",
                paymentMethod
            );


        if (paymentStatus)
            params.append(
                "payment_status",
                paymentStatus
            );


        const response =
            await fetch(
                `/api/admin/registrations?${params}`
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message
            );

        }


        registrations =
            data.registrations;


        renderRegistrations();


    } catch (error) {

        console.error(
            "Registration loading error:",
            error
        );

    }

}


// ============================================
// RENDER REGISTRATIONS
// ============================================
function renderRegistrations() {

    const table =
        document.getElementById(
            "registrationTable"
        );


    table.innerHTML = "";


    if (registrations.length === 0) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    style="text-align:center"
                >
                    No registrations found.
                </td>

            </tr>

        `;

        return;
    }


    registrations.forEach(reg => {

        const row =
            document.createElement("tr");


        const date =
            new Date(
                reg.created_at
            ).toLocaleString();


        const statusClass =
            reg.payment_status === "PAID"
                ? "status-paid"
                : "status-pending";


        const paymentButton =
            reg.payment_status === "PENDING"
                ? `
                    <button
                        class="action-btn pay-btn"
                        onclick="markPaid(${reg.id})"
                    >
                        Mark Paid
                    </button>
                  `
                : "";


        row.innerHTML = `

    <td>
        <strong>
            ${reg.registration_no}
        </strong>
    </td>

    <td>
        ${reg.full_name}
    </td>

    <td>
        ${reg.diocese}
    </td>

    <td>
        ${reg.gender}
    </td>

    <td>
        ${formatPayment(reg.payment_method)}
    </td>

    <td>
        ${reg.payment_reference || "-"}
    </td>

    <td>
        ${
            reg.amount_received !== null &&
            reg.amount_received !== undefined
                ? `Ksh ${Number(reg.amount_received).toLocaleString()}`
                : "-"
        }
    </td>

    <td>

        <span
            class="status ${statusClass}"
        >
            ${reg.payment_status}
        </span>

    </td>

    <td>
        ${date}
    </td>

    <td>

        ${paymentButton}

        <button
            class="action-btn delete-btn"
            onclick="deleteRegistration(${reg.id})"
        >
            Delete
        </button>

    </td>

`;


        table.appendChild(row);

    });

}


// ============================================
// PAYMENT DISPLAY
// ============================================
function formatPayment(method) {

    if (method === "MPESA")
        return "M-Pesa";

    if (method === "CASH")
        return "Cash";

    if (method === "CHEQUE")
        return "Cheque";
    if (method === "BANK_TRANSFER")
        return "Bank Transfer";

    return method;

}


// ============================================
// MARK PAYMENT PAID
// ============================================
async function markPaid(id) {

    const confirmed =
        confirm(
            "Are you sure you want to mark this payment as PAID?"
        );


    if (!confirmed)
        return;


    try {

        const response =
            await fetch(
                `/api/admin/registrations/${id}/payment`,
                {
                    method: "PATCH"
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            alert(
                data.message ||
                "Failed to update payment"
            );

            return;
        }


        await loadRegistrations();

        await loadStatistics();


    } catch (error) {

        console.error(
            error
        );

        alert(
            "Failed to update payment"
        );

    }

}


// ============================================
// DELETE REGISTRATION
// ============================================
async function deleteRegistration(id) {

    const confirmed =
        confirm(
            "WARNING: Are you sure you want to permanently delete this registration?"
        );


    if (!confirmed)
        return;


    try {

        const response =
            await fetch(
                `/api/admin/registrations/${id}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            alert(
                data.message ||
                "Failed to delete registration"
            );

            return;
        }


        await loadRegistrations();

        await loadStatistics();


    } catch (error) {

        console.error(
            error
        );

        alert(
            "Failed to delete registration"
        );

    }

}


// ============================================
// CLEAR FILTERS
// ============================================
function clearFilters() {

    document.getElementById(
        "searchName"
    ).value = "";


    document.getElementById(
        "filterDiocese"
    ).value = "";


    document.getElementById(
        "filterGender"
    ).value = "";


    document.getElementById(
        "filterPaymentMethod"
    ).value = "";


    document.getElementById(
        "filterPaymentStatus"
    ).value = "";


    loadRegistrations();

}


// ============================================
// EXPORT EXCEL
// ============================================
function exportRegistrations() {

    const diocese =
        document.getElementById(
            "exportDiocese"
        ).value;


    if (diocese) {

        window.location.href =
            `/api/admin/export?diocese=${diocese}`;

    } else {

        window.location.href =
            "/api/admin/export";

    }

}


// ============================================
// LOGOUT
// ============================================
async function logout() {

    try {

        await fetch(
            "/api/admin/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.error(error);

    }

    window.location.href =
        "/admin-login.html";

}


// ============================================
// START DASHBOARD
// ============================================
async function initializeDashboard() {

    await loadDioceses();

    await loadStatistics();

    await loadRegistrations();

}


initializeDashboard();