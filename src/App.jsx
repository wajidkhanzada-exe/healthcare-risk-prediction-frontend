import { useState, useEffect } from 'react'
import axios from 'axios'
import { supabase } from './supabaseClient'
import Auth from './Auth'

const API_BASE = "http://127.0.0.1:5000"

// -----------------------------------------------------------------------
// FIELD MAPPINGS
// -----------------------------------------------------------------------

function mapGenderToHeart(gender) {
  // Heart dataset uses M/F.
  // "Other" has no direct equivalent, so it falls back to F.
  return gender === "Male" ? "M" : "F"
}

function mapGenderToCKD(gender) {
  // Assumed CKD mapping:
  // Female -> 0
  // Male -> 1
  //
  // IMPORTANT:
  // Verify this against the CKD training notebook before final production use.
  if (gender === "Male") return "1"
  return "0"
}

function mapSmokingToCKD(smokingHistory) {
  // CKD dataset uses a binary smoking flag.
  // Only current smoker is mapped to 1.
  return smokingHistory === "current" ? "1" : "0"
}

// -----------------------------------------------------------------------
// FIELD CATALOG
// -----------------------------------------------------------------------

const FIELD_CATALOG = [
  {
    category: "Personal Information",
    fields: [
      {
        id: "fullName",
        label: "Full Name",
        description:
          "Used to label your report. Not used in any risk calculation.",
        type: "text",
        required: true,
        targets: []
      },

      {
        id: "age",
        label: "Age",
        description: "Your age in years.",
        type: "number",
        required: true,
        min: 1,
        max: 120,
        targets: [
          {
            disease: "diabetes",
            field: "age"
          },
          {
            disease: "heart",
            field: "Age"
          },
          {
            disease: "ckd",
            field: "Age"
          }
        ]
      },

      {
        id: "gender",
        label: "Gender",
        description: "Used because some risk factors differ by sex.",
        type: "select",
        required: true,
        options: ["Male", "Female", "Other"],
        targets: [
          {
            disease: "diabetes",
            field: "gender",
            transform: v => v
          },
          {
            disease: "heart",
            field: "Sex",
            transform: mapGenderToHeart
          },
          {
            disease: "ckd",
            field: "Gender",
            transform: mapGenderToCKD
          }
        ]
      },

      {
        id: "smokingHistory",
        label: "Smoking History",
        description: "Your current and past smoking habits.",
        type: "select",
        required: true,
        options: [
          "never",
          "current",
          "former",
          "ever",
          "not current",
          "No Info"
        ],
        optionLabels: {
          never: "Never smoked",
          current: "Currently smoke",
          former: "Former smoker",
          ever: "Smoked at some point",
          "not current": "Used to smoke, not currently",
          "No Info": "Prefer not to say"
        },
        targets: [
          {
            disease: "diabetes",
            field: "smoking_history",
            transform: v => v
          },
          {
            disease: "ckd",
            field: "Smoking",
            transform: mapSmokingToCKD
          }
        ]
      }
    ]
  },

  {
    category: "Body Measurements",
    fields: [
      {
        id: "bmi",
        label: "BMI (Body Mass Index)",
        description:
          "Weight(kg) divided by height(m) squared. Ask your clinic or use an online BMI calculator if you don't have this.",
        type: "number",
        required: true,
        step: "0.1",
        min: 10,
        max: 70,
        targets: [
          {
            disease: "diabetes",
            field: "bmi"
          },
          {
            disease: "ckd",
            field: "BMI"
          }
        ]
      }
    ]
  },

  {
    category: "Blood Pressure",
    fields: [
      {
        id: "systolicBP",
        label: "Systolic Blood Pressure",
        description:
          "The higher number in a blood pressure reading, e.g. the 120 in 120/80.",
        type: "number",
        required: true,
        min: 60,
        max: 250,
        targets: [
          {
            disease: "heart",
            field: "RestingBP"
          },
          {
            disease: "ckd",
            field: "SystolicBP"
          }
        ]
      },

      {
        id: "diastolicBP",
        label: "Diastolic Blood Pressure",
        description:
          "The lower number in a blood pressure reading, e.g. the 80 in 120/80. Optional — leave blank if unknown.",
        type: "number",
        required: false,
        min: 40,
        max: 150,
        targets: [
          {
            disease: "ckd",
            field: "DiastolicBP"
          }
        ]
      }
    ]
  },

  {
    category: "Blood Sugar",
    fields: [
      {
        id: "bloodGlucose",
        label: "Blood Glucose Level (random reading)",
        description:
          "A blood sugar reading taken at any time of day, not necessarily fasting. In mg/dL.",
        type: "number",
        required: true,
        min: 40,
        max: 400,
        targets: [
          {
            disease: "diabetes",
            field: "blood_glucose_level"
          }
        ]
      },

      {
        id: "fastingBloodSugar",
        label: "Fasting Blood Sugar",
        description:
          "A blood sugar reading taken after at least 8 hours without food. In mg/dL.",
        type: "number",
        required: true,
        min: 40,
        max: 400,
        targets: [
          {
            disease: "heart",
            field: "FastingBS",
            transform: v =>
              parseFloat(v) > 120 ? "1" : "0"
          },
          {
            disease: "ckd",
            field: "FastingBloodSugar"
          }
        ]
      },

      {
        id: "hba1c",
        label: "HbA1c Level",
        description:
          "Average blood sugar over the past 2-3 months, from a standard HbA1c blood test (%).",
        type: "number",
        required: true,
        step: "0.1",
        min: 3,
        max: 15,
        targets: [
          {
            disease: "diabetes",
            field: "HbA1c_level"
          },
          {
            disease: "ckd",
            field: "HbA1c"
          }
        ]
      }
    ]
  },

  {
    category: "Cholesterol",
    fields: [
      {
        id: "totalCholesterol",
        label: "Total Cholesterol",
        description:
          "From a standard lipid panel, in mg/dL.",
        type: "number",
        required: true,
        min: 80,
        max: 500,
        targets: [
          {
            disease: "heart",
            field: "Cholesterol"
          },
          {
            disease: "ckd",
            field: "CholesterolTotal"
          }
        ]
      },

      {
        id: "ldl",
        label: "LDL Cholesterol",
        description:
          '"Bad" cholesterol, from the same lipid panel. Optional.',
        type: "number",
        required: false,
        min: 20,
        max: 300,
        targets: [
          {
            disease: "ckd",
            field: "CholesterolLDL"
          }
        ]
      },

      {
        id: "hdl",
        label: "HDL Cholesterol",
        description:
          '"Good" cholesterol, from the same lipid panel. Optional.',
        type: "number",
        required: false,
        min: 10,
        max: 150,
        targets: [
          {
            disease: "ckd",
            field: "CholesterolHDL"
          }
        ]
      },

      {
        id: "triglycerides",
        label: "Triglycerides",
        description:
          "From the same lipid panel. Optional.",
        type: "number",
        required: false,
        min: 30,
        max: 600,
        targets: [
          {
            disease: "ckd",
            field: "CholesterolTriglycerides"
          }
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------
  // KIDNEY FUNCTION LABS
  // ---------------------------------------------------------------------

  {
    category: "Kidney Function Labs",
    description:
      "These come from a more detailed kidney panel. Sodium and Potassium are required for the CKD prediction. Other kidney values can be left blank if unavailable.",
    fields: [
      {
        id: "creatinine",
        label: "Serum Creatinine",
        description:
          "Key kidney function marker, mg/dL.",
        type: "number",
        required: false,
        step: "0.1",
        min: 0.2,
        max: 15,
        targets: [
          {
            disease: "ckd",
            field: "SerumCreatinine"
          }
        ]
      },

      {
        id: "bun",
        label: "Blood Urea Nitrogen (BUN)",
        description:
          "Kidney function marker, mg/dL.",
        type: "number",
        required: false,
        min: 2,
        max: 150,
        targets: [
          {
            disease: "ckd",
            field: "BUNLevels"
          }
        ]
      },

      {
        id: "gfr",
        label: "GFR (Glomerular Filtration Rate)",
        description:
          "Estimates how well your kidneys filter blood, mL/min.",
        type: "number",
        required: false,
        min: 1,
        max: 150,
        targets: [
          {
            disease: "ckd",
            field: "GFR"
          }
        ]
      },

      {
        id: "proteinInUrine",
        label: "Protein in Urine",
        description:
          "From a urinalysis, g/day.",
        type: "number",
        required: false,
        step: "0.1",
        min: 0,
        max: 15,
        targets: [
          {
            disease: "ckd",
            field: "ProteinInUrine"
          }
        ]
      },

      {
        id: "acr",
        label: "Albumin-Creatinine Ratio (ACR)",
        description:
          "From a urine test, mg/g.",
        type: "number",
        required: false,
        min: 0,
        max: 1000,
        targets: [
          {
            disease: "ckd",
            field: "ACR"
          }
        ]
      },

      {
        id: "sodium",
        label: "Sodium",
        description:
          "Blood electrolyte level, mEq/L. Required for CKD prediction.",
        type: "number",
        required: true,
        min: 110,
        max: 160,
        targets: [
          {
            disease: "ckd",
            field: "SerumElectrolytesSodium"
          }
        ]
      },

      {
        id: "potassium",
        label: "Potassium",
        description:
          "Blood electrolyte level, mEq/L. Required for CKD prediction.",
        type: "number",
        required: true,
        step: "0.1",
        min: 2,
        max: 8,
        targets: [
          {
            disease: "ckd",
            field: "SerumElectrolytesPotassium"
          }
        ]
      },

      {
        id: "calcium",
        label: "Calcium",
        description:
          "Blood electrolyte level, mg/dL.",
        type: "number",
        required: false,
        step: "0.1",
        min: 5,
        max: 14,
        targets: [
          {
            disease: "ckd",
            field: "SerumElectrolytesCalcium"
          }
        ]
      },

      {
        id: "phosphorus",
        label: "Phosphorus",
        description:
          "Blood electrolyte level, mg/dL.",
        type: "number",
        required: false,
        step: "0.1",
        min: 1,
        max: 10,
        targets: [
          {
            disease: "ckd",
            field: "SerumElectrolytesPhosphorus"
          }
        ]
      },

      {
        id: "hemoglobin",
        label: "Hemoglobin",
        description:
          "From a complete blood count, g/dL.",
        type: "number",
        required: false,
        step: "0.1",
        min: 3,
        max: 20,
        targets: [
          {
            disease: "ckd",
            field: "HemoglobinLevels"
          }
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------
  // SYMPTOMS
  // ---------------------------------------------------------------------

  {
    category: "Symptoms",
    fields: [
      {
        id: "chestPainType",
        label: "Chest Pain Type",
        description:
          "The kind of chest discomfort you experience, if any.",
        type: "select",
        required: true,
        options: [
          "ATA",
          "NAP",
          "ASY",
          "TA"
        ],
        optionLabels: {
          ATA: "Comes with exertion, eases with rest (typical angina pattern)",
          NAP: "Chest pain not clearly linked to exertion",
          ASY: "No chest pain",
          TA: "Brief, sharp chest pain"
        },
        targets: [
          {
            disease: "heart",
            field: "ChestPainType"
          }
        ]
      },

      {
        id: "exerciseAngina",
        label: "Chest Pain During Exercise",
        description:
          "Do you get chest pain or tightness during physical activity?",
        type: "select",
        required: true,
        options: [
          "N",
          "Y"
        ],
        optionLabels: {
          N: "No",
          Y: "Yes"
        },
        targets: [
          {
            disease: "heart",
            field: "ExerciseAngina"
          }
        ]
      },

      {
        id: "edema",
        label: "Swelling in Legs, Ankles or Feet (Edema)",
        description:
          "Optional.",
        type: "select",
        required: false,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "ckd",
            field: "Edema"
          }
        ]
      },

      {
        id: "fatigueLevel",
        label: "Fatigue Level",
        description:
          "0 = none, 10 = severe. Optional, defaults to 0 if left blank.",
        type: "number",
        required: false,
        min: 0,
        max: 10,
        defaultValue: "0",
        targets: [
          {
            disease: "ckd",
            field: "FatigueLevels"
          }
        ]
      },

      {
        id: "nauseaLevel",
        label: "Nausea / Vomiting Level",
        description:
          "0 = none, 10 = severe. Optional, defaults to 0 if left blank.",
        type: "number",
        required: false,
        min: 0,
        max: 10,
        defaultValue: "0",
        targets: [
          {
            disease: "ckd",
            field: "NauseaVomiting"
          }
        ]
      },

      {
        id: "muscleCrampsLevel",
        label: "Muscle Cramps Level",
        description:
          "0 = none, 10 = severe. Optional, defaults to 0 if left blank.",
        type: "number",
        required: false,
        min: 0,
        max: 10,
        defaultValue: "0",
        targets: [
          {
            disease: "ckd",
            field: "MuscleCramps"
          }
        ]
      },

      {
        id: "itchingLevel",
        label: "Itching Level",
        description:
          "0 = none, 10 = severe. Optional, defaults to 0 if left blank.",
        type: "number",
        required: false,
        min: 0,
        max: 10,
        defaultValue: "0",
        targets: [
          {
            disease: "ckd",
            field: "Itching"
          }
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------
  // MEDICAL HISTORY
  // ---------------------------------------------------------------------

  {
    category: "Medical History",
    fields: [
      {
        id: "hasHypertension",
        label:
          "Do you personally have hypertension (high blood pressure)?",
        description:
          "Your own diagnosis, not a family member's.",
        type: "select",
        required: true,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "diabetes",
            field: "hypertension"
          }
        ]
      },

      {
        id: "hasHeartDisease",
        label:
          "Do you have a personal history of heart disease?",
        description: "",
        type: "select",
        required: true,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "diabetes",
            field: "heart_disease"
          }
        ]
      },

      {
        id: "previousAKI",
        label:
          "Have you had a previous acute kidney injury?",
        description:
          "Optional.",
        type: "select",
        required: false,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "ckd",
            field: "PreviousAcuteKidneyInjury"
          }
        ]
      },

      {
        id: "utiHistory",
        label:
          "History of urinary tract infections?",
        description:
          "Optional.",
        type: "select",
        required: false,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "ckd",
            field: "UrinaryTractInfections"
          }
        ]
      },

      {
        id: "familyKidneyDisease",
        label:
          "Family history of kidney disease?",
        description:
          "Optional.",
        type: "select",
        required: false,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "ckd",
            field: "FamilyHistoryKidneyDisease"
          }
        ]
      },

      {
        id: "familyHypertension",
        label:
          "Family history of hypertension?",
        description:
          "Optional.",
        type: "select",
        required: false,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "ckd",
            field: "FamilyHistoryHypertension"
          }
        ]
      },

      {
        id: "familyDiabetes",
        label:
          "Family history of diabetes?",
        description:
          "Optional.",
        type: "select",
        required: false,
        options: [
          "0",
          "1"
        ],
        optionLabels: {
          "0": "No",
          "1": "Yes"
        },
        targets: [
          {
            disease: "ckd",
            field: "FamilyHistoryDiabetes"
          }
        ]
      }
    ]
  }
]

// -----------------------------------------------------------------------
// PLACEHOLDER HINTS
// -----------------------------------------------------------------------

const PLACEHOLDER_HINTS = {
  fullName: "e.g. Ahmed Khan",
  age: "e.g. 45",
  fatigueLevel: "0 (none) to 10 (severe)",
  nauseaLevel: "0 (none) to 10 (severe)",
  muscleCrampsLevel: "0 (none) to 10 (severe)",
  itchingLevel: "0 (none) to 10 (severe)"
}

function getPlaceholder(field) {
  if (PLACEHOLDER_HINTS[field.id]) {
    return PLACEHOLDER_HINTS[field.id]
  }

  if (
    field.min !== undefined &&
    field.max !== undefined
  ) {
    return `Range: ${field.min}-${field.max}`
  }

  return ""
}

// -----------------------------------------------------------------------
// ALL FIELDS
// -----------------------------------------------------------------------

const ALL_FIELDS = FIELD_CATALOG.flatMap(
  group => group.fields
)

// -----------------------------------------------------------------------
// BUILD PREDICTION PAYLOAD
// -----------------------------------------------------------------------

function buildPayload(values) {
  const payload = {
    diabetes: {},
    heart: {},
    ckd: {}
  }

  for (const field of ALL_FIELDS) {
    const raw = values[field.id]

    const value =
      raw === undefined || raw === ""
        ? field.defaultValue
        : raw

    if (
      value === undefined ||
      value === ""
    ) {
      continue
    }

    for (const target of field.targets) {
      const finalValue = target.transform
        ? target.transform(value)
        : value

      payload[target.disease][target.field] =
        field.type === "number"
          ? parseFloat(finalValue)
          : finalValue
    }
  }

  return payload
}

// -----------------------------------------------------------------------
// VALIDATE REQUIRED FIELDS
// -----------------------------------------------------------------------

function missingRequiredFields(values) {
  return ALL_FIELDS.filter(
    field =>
      field.required &&
      (
        values[field.id] === undefined ||
        values[field.id] === ""
      )
  )
}

// -----------------------------------------------------------------------
// SIMPLE MARKDOWN RENDERER
// -----------------------------------------------------------------------

function MarkdownLite({ text }) {
  if (!text) {
    return null
  }

  const lines = String(text)
    .split("\n")
    .filter(line => line.trim() !== "")

  return (
    <div className="text-sm space-y-1.5 text-slate-700">
      {lines.map((line, index) => {
        const trimmed = line.trim()

        if (trimmed.startsWith("## ")) {
          return (
            <p
              key={index}
              className="font-semibold mt-3 text-slate-800"
            >
              {trimmed.slice(3)}
            </p>
          )
        }

        if (
          trimmed.startsWith("* ") ||
          trimmed.startsWith("- ")
        ) {
          return (
            <p
              key={index}
              className="ml-3"
            >
              • {trimmed.slice(2).replace(/\*\*/g, "")}
            </p>
          )
        }

        return (
          <p key={index}>
            {trimmed.replace(/\*\*/g, "")}
          </p>
        )
      })}
    </div>
  )
}

// -----------------------------------------------------------------------
// MAIN APP
// -----------------------------------------------------------------------

function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [backendUp, setBackendUp] = useState(null)

  const [values, setValues] = useState({})
  const [result, setResult] = useState(null)

  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [extracting, setExtracting] = useState(false)
  const [extractMessage, setExtractMessage] = useState(null)

  // History
  const [activeTab, setActiveTab] = useState("new")
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [selectedHistoryReport, setSelectedHistoryReport] =
    useState(null)

  // ---------------------------------------------------------------------
  // CHECK BACKEND
  // ---------------------------------------------------------------------

  useEffect(() => {
    axios
      .get(`${API_BASE}/health`)
      .then(() => setBackendUp(true))
      .catch(() => setBackendUp(false))
  }, [])

  // ---------------------------------------------------------------------
  // SUPABASE SESSION
  // ---------------------------------------------------------------------

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return

        setSession(data.session)
        setCheckingSession(false)
      })
      .catch(error => {
        console.error("Session error:", error)

        if (mounted) {
          setSession(null)
          setCheckingSession(false)
        }
      })

    const {
      data: authListener
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  // ---------------------------------------------------------------------
  // LOAD HISTORY WHEN HISTORY TAB IS OPENED
  // ---------------------------------------------------------------------

  useEffect(() => {
    if (
      session &&
      activeTab === "history"
    ) {
      loadHistory()
    }
  }, [session, activeTab])

  // ---------------------------------------------------------------------
  // SIGN OUT
  // ---------------------------------------------------------------------

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()

      setSession(null)
      setResult(null)
      setValues({})
      setHistory([])
      setSelectedHistoryReport(null)
      setActiveTab("new")
    } catch (err) {
      console.error("Sign out error:", err)
    }
  }

  // ---------------------------------------------------------------------
  // FIELD CHANGE
  // ---------------------------------------------------------------------

  const handleChange = (fieldId, value) => {
    setValues(prev => ({
      ...prev,
      [fieldId]: value
    }))
  }

  // ---------------------------------------------------------------------
  // BLOOD REPORT UPLOAD / EXTRACTION
  // ---------------------------------------------------------------------

  const handleFileUpload = async event => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!session?.access_token) {
      setExtractMessage(
        "Please login again before uploading a report."
      )
      return
    }

    setExtracting(true)
    setExtractMessage(null)

    const formData = new FormData()

    formData.append("report", file)

    try {
      const response = await axios.post(
        `${API_BASE}/extract-report`,
        formData,
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`
          }
        }
      )

      const extracted =
        response.data?.extracted_fields || {}

      if (
        !extracted ||
        Object.keys(extracted).length === 0
      ) {
        setExtractMessage(
          "Report se koi field nahi mil saki. Manually fill kar lo."
        )
      } else {
        setValues(prev => ({
          ...prev,
          ...extracted
        }))

        setExtractMessage(
          `${Object.keys(extracted).length} fields report se bhar diye gaye. Please neeche review karo.`
        )
      }
    } catch (err) {
      console.error(
        "Extraction error:",
        err
      )

      setExtractMessage(
        err.response?.data?.error ||
        "Extraction fail hui. Manually fill karo."
      )
    } finally {
      setExtracting(false)

      // Allows uploading the same file again.
      event.target.value = ""
    }
  }

  // ---------------------------------------------------------------------
  // SUBMIT REPORT
  // ---------------------------------------------------------------------

  const handleSubmit = async () => {
    setError(null)
    setResult(null)

    if (!session?.access_token) {
      setError(
        "Your login session has expired. Please login again."
      )
      return
    }

    const missing =
      missingRequiredFields(values)

    if (missing.length > 0) {
      setError(
        `Please fill in: ${missing
          .map(field => field.label)
          .join(", ")}`
      )
      return
    }

    setLoading(true)

    try {
      const predictionPayload =
        buildPayload(values)

      // IMPORTANT:
      // Backend /report/full expects fullName and age
      // at the top level so Supabase can save patient_name
      // and patient_age.
      const payload = {
        fullName: values.fullName,
        age: values.age,
        gender: values.gender,
        ...predictionPayload
      }

      console.log(
        "Report payload:",
        payload
      )

      const response = await axios.post(
        `${API_BASE}/report/full`,
        payload,
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`
          }
        }
      )

      setResult(response.data)

      // Automatically refresh history after
      // successfully generating/saving a report.
      if (activeTab === "history") {
        await loadHistory()
      }
    } catch (err) {
      console.error(
        "Report generation error:",
        err
      )

      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Something went wrong. Check the browser console and Flask terminal."
      )
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------
  // LOAD REPORT HISTORY
  // ---------------------------------------------------------------------

  const loadHistory = async () => {
    if (!session?.user?.id) {
      return
    }

    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const {
        data,
        error: supabaseError
      } = await supabase
        .from("reports")
        .select(`
          id,
          user_id,
          patient_name,
          patient_age,
          report_data,
          created_at
        `)
        .eq(
          "user_id",
          session.user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )

      if (supabaseError) {
        throw supabaseError
      }

      setHistory(data || [])
    } catch (err) {
      console.error(
        "History loading error:",
        err
      )

      setHistoryError(
        err.message ||
        "Previous reports load nahi ho sake."
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  // ---------------------------------------------------------------------
  // OPEN HISTORY REPORT
  // ---------------------------------------------------------------------

  const openHistoryReport = report => {
    setSelectedHistoryReport(report)
  }

  // ---------------------------------------------------------------------
  // BACKEND / SESSION STATES
  // ---------------------------------------------------------------------

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-slate-400 text-sm">
          Loading...
        </p>
      </div>
    )
  }

  if (!session) {
    return (
      <Auth
        onLoginSuccess={newSession =>
          setSession(newSession)
        }
      />
    )
  }

  if (backendUp === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md text-center">
          <p className="font-medium text-slate-800">
            Backend unavailable
          </p>

          <p className="text-sm text-slate-500 mt-2">
            Can't reach the Flask server.
            Please make sure your backend is running.
          </p>

          <p className="text-xs text-slate-400 mt-3">
            {API_BASE}
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------
  // MAIN UI
  // ---------------------------------------------------------------------

  return (
    <>
      <style>
        {`
          @media print {
            body {
              background: white !important;
            }

            .no-print {
              display: none !important;
            }

            .printable-report {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .printable-report * {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            @page {
              size: A4;
              margin: 12mm;
            }
          }
        `}
      </style>

      <div className="min-h-screen bg-stone-50">

        {/* ------------------------------------------------------------- */}
        {/* HEADER */}
        {/* ------------------------------------------------------------- */}

        <header className="border-b border-stone-200 bg-white no-print">
          <div className="max-w-2xl mx-auto px-6 py-7">

            <div className="flex items-center gap-3">

              <div>
                <h1 className="text-2xl font-semibold text-slate-800">
                  Health Risk Assessment
                </h1>

                <p className="text-slate-500 mt-1 text-sm">
                  Answer what you can from a recent blood report
                  or your own knowledge. Fields marked with a dot
                  are required; everything else is optional.
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="ml-auto text-sm text-slate-500 hover:text-slate-700 whitespace-nowrap"
              >
                Sign out
              </button>

            </div>

            {/* --------------------------------------------------------- */}
            {/* TABS */}
            {/* --------------------------------------------------------- */}

            <div className="flex gap-2 mt-6">

              <button
                type="button"
                onClick={() => {
                  setActiveTab("new")
                  setSelectedHistoryReport(null)
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "new"
                    ? "bg-teal-700 text-white"
                    : "bg-stone-100 text-slate-600 hover:bg-stone-200"
                }`}
              >
                New Assessment
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("history")
                  setSelectedHistoryReport(null)
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "history"
                    ? "bg-teal-700 text-white"
                    : "bg-stone-100 text-slate-600 hover:bg-stone-200"
                }`}
              >
                History
              </button>

            </div>

          </div>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* NEW ASSESSMENT */}
        {/* ------------------------------------------------------------- */}

        {activeTab === "new" && (
          <main className="max-w-2xl mx-auto px-6 py-8">

            {/* --------------------------------------------------------- */}
            {/* BLOOD REPORT UPLOAD */}
            {/* --------------------------------------------------------- */}

            <div className="bg-teal-50 border border-teal-200 rounded-md p-6 mb-8 no-print">

              <h2 className="text-base font-semibold text-slate-800 mb-1">
                Option: Upload a blood report (PDF or image)
              </h2>

              <p className="text-sm text-slate-500 mb-3">
                Upload your lab reports one at a time —
                CBC, lipid panel, HbA1c, or kidney panel.
                Extracted values will be added to your form.
              </p>

              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileUpload}
                disabled={extracting}
                className="text-sm block w-full"
              />

              {extracting && (
                <p className="text-sm text-teal-700 mt-3">
                  Report padh rahe hain...
                </p>
              )}

              {extractMessage && (
                <p className="text-sm text-slate-700 mt-3">
                  {extractMessage}
                </p>
              )}

            </div>

            {/* --------------------------------------------------------- */}
            {/* FORM */}
            {/* --------------------------------------------------------- */}

            <div className="no-print">

              {FIELD_CATALOG.map(group => (
                <CategorySection
                  key={group.category}
                  group={group}
                  values={values}
                  onChange={handleChange}
                />
              ))}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-teal-700 text-white font-medium py-3 rounded-md hover:bg-teal-800 disabled:bg-stone-300 transition-colors"
              >
                {loading
                  ? "Generating Risk Report..."
                  : "Get My Risk Report"}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mt-4">
                  <p className="text-sm font-medium">
                    Report generation failed
                  </p>

                  <p className="text-sm mt-1">
                    {error}
                  </p>
                </div>
              )}

            </div>

            {/* --------------------------------------------------------- */}
            {/* CURRENT RESULT */}
            {/* --------------------------------------------------------- */}

            {result && (
              <ResultReport
                result={result}
                name={values.fullName}
                patientAge={values.age}
              />
            )}

          </main>
        )}

        {/* ------------------------------------------------------------- */}
        {/* HISTORY */}
        {/* ------------------------------------------------------------- */}

        {activeTab === "history" && (
          <main className="max-w-2xl mx-auto px-6 py-8">

            <HistoryView
              history={history}
              loading={historyLoading}
              error={historyError}
              selectedReport={selectedHistoryReport}
              onSelectReport={
                openHistoryReport
              }
              onBack={() =>
                setSelectedHistoryReport(null)
              }
            />

          </main>
        )}

      </div>
    </>
  )
}

// -----------------------------------------------------------------------
// CATEGORY SECTION
// -----------------------------------------------------------------------

function CategorySection({
  group,
  values,
  onChange
}) {
  return (
    <section className="mb-8 pb-8 border-b border-stone-200 last:border-b-0">

      <h2 className="text-base font-semibold text-slate-800 mb-1">
        {group.category}
      </h2>

      {group.description && (
        <p className="text-sm text-slate-500 mb-4">
          {group.description}
        </p>
      )}

      <div className="space-y-4">

        {group.fields.map(field => (
          <FieldInput
            key={field.id}
            field={field}
            value={
              values[field.id] !== undefined
                ? values[field.id]
                : ""
            }
            onChange={value =>
              onChange(field.id, value)
            }
          />
        ))}

      </div>

    </section>
  )
}

// -----------------------------------------------------------------------
// FIELD INPUT
// -----------------------------------------------------------------------

function FieldInput({
  field,
  value,
  onChange
}) {
  return (
    <div>

      <label className="flex items-baseline gap-1.5 text-sm font-medium text-slate-700 mb-1">

        <span>
          {field.label}
        </span>

        {field.required && (
          <span
            className="text-teal-600 text-xs"
            aria-hidden="true"
          >
            ●
          </span>
        )}

      </label>

      {field.description && (
        <p className="text-xs text-slate-500 mb-1.5">
          {field.description}
        </p>
      )}

      {field.type === "select" ? (

        <select
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
          value={value}
          onChange={event =>
            onChange(event.target.value)
          }
        >

          <option value="">
            Select...
          </option>

          {field.options.map(option => (
            <option
              key={option}
              value={option}
            >
              {field.optionLabels?.[option] ||
                option}
            </option>
          ))}

        </select>

      ) : (

        <input
          type={field.type}
          step={field.step}
          min={field.min}
          max={field.max}
          placeholder={getPlaceholder(field)}
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
          value={value}
          onChange={event =>
            onChange(event.target.value)
          }
        />

      )}

    </div>
  )
}

// -----------------------------------------------------------------------
// HISTORY VIEW
// -----------------------------------------------------------------------

function HistoryView({
  history,
  loading,
  error,
  selectedReport,
  onSelectReport,
  onBack
}) {
  // ---------------------------------------------------------------
  // SELECTED REPORT
  // ---------------------------------------------------------------

  if (selectedReport) {
    let reportData =
      selectedReport.report_data

    if (
      typeof reportData === "string"
    ) {
      try {
        reportData = JSON.parse(reportData)
      } catch (parseError) {
        console.error(
          "History report JSON parse error:",
          parseError
        )

        reportData = null
      }
    }

    if (!reportData) {
      return (
        <div>

          <button
            type="button"
            onClick={onBack}
            className="text-sm text-teal-700 hover:text-teal-900 mb-5 no-print"
          >
            ← Back to History
          </button>

          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-700">
              This report could not be read.
            </p>
          </div>

        </div>
      )
    }

    return (
      <div>

        <div className="no-print mb-5 flex items-center justify-between gap-3">

          <button
            type="button"
            onClick={onBack}
            className="text-sm text-teal-700 hover:text-teal-900"
          >
            ← Back to History
          </button>

        </div>

        <ResultReport
          result={reportData}
          name={selectedReport.patient_name}
          patientAge={
            selectedReport.patient_age
          }
          createdAt={
            selectedReport.created_at
          }
        />

      </div>
    )
  }

  // ---------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-6 text-center">

        <p className="text-sm text-slate-500">
          Loading your previous reports...
        </p>

      </div>
    )
  }

  // ---------------------------------------------------------------
  // ERROR
  // ---------------------------------------------------------------

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-5">

        <p className="font-medium text-red-800">
          Could not load history
        </p>

        <p className="text-sm text-red-700 mt-1">
          {error}
        </p>

        <p className="text-xs text-red-600 mt-3">
          Agar Supabase RLS error aa raha hai to reports
          table ke SELECT policy ko check karo.
        </p>

      </div>
    )
  }

  // ---------------------------------------------------------------
  // EMPTY HISTORY
  // ---------------------------------------------------------------

  if (!history || history.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">

        <p className="font-medium text-slate-800">
          No previous reports
        </p>

        <p className="text-sm text-slate-500 mt-2">
          Abhi tak koi saved report nahi mili.
        </p>

      </div>
    )
  }

  // ---------------------------------------------------------------
  // HISTORY LIST
  // ---------------------------------------------------------------

  return (
    <div>

      <div className="mb-5">

        <h2 className="text-lg font-semibold text-slate-800">
          Previous Reports
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          Your previously generated risk reports.
        </p>

      </div>

      <div className="space-y-3">

        {history.map(report => {

          let reportData =
            report.report_data

          if (
            typeof reportData === "string"
          ) {
            try {
              reportData =
                JSON.parse(reportData)
            } catch {
              reportData = null
            }
          }

          const summary =
            reportData?.summary

          const highestDisease =
            summary?.highest_risk_disease ||
            "Risk report"

          const highestCategory =
            summary?.highest_risk_category ||
            "N/A"

          const createdDate =
            report.created_at
              ? new Date(
                  report.created_at
                ).toLocaleString()
              : "Unknown date"

          return (
            <div
              key={report.id}
              className="bg-white border border-stone-200 rounded-lg p-5"
            >

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

                <div>

                  <p className="font-medium text-slate-800">
                    {report.patient_name ||
                      "Unnamed Patient"}
                  </p>

                  {report.patient_age !==
                    null &&
                    report.patient_age !==
                      undefined && (
                      <p className="text-xs text-slate-500 mt-1">
                        Age:{" "}
                        {report.patient_age}
                      </p>
                    )}

                  <p className="text-xs text-slate-400 mt-1">
                    {createdDate}
                  </p>

                  <div className="mt-3">

                    <p className="text-xs text-slate-500">
                      Highest Risk
                    </p>

                    <p className="text-sm font-medium text-slate-700">
                      {highestDisease}
                    </p>

                    <p className="text-xs text-slate-500">
                      Category:{" "}
                      {highestCategory}
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    onSelectReport(report)
                  }
                  className="bg-teal-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-800 transition-colors whitespace-nowrap"
                >
                  View Report
                </button>

              </div>

            </div>
          )
        })}

      </div>

    </div>
  )
}

// -----------------------------------------------------------------------
// RESULT REPORT
// -----------------------------------------------------------------------

function ResultReport({
  result,
  name,
  patientAge,
  createdAt
}) {
  const categoryStyle = {
    Low:
      "bg-emerald-50 border-emerald-300 text-emerald-800",

    Medium:
      "bg-amber-50 border-amber-300 text-amber-800",

    High:
      "bg-rose-50 border-rose-300 text-rose-800"
  }

  // ---------------------------------------------------------------
  // SAFETY CHECK
  // ---------------------------------------------------------------

  if (
    !result ||
    !result.results
  ) {
    return (
      <div className="mt-10 printable-report">

        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md p-4">

          <p className="font-medium">
            Prediction could not be completed.
          </p>

          {result?.error && (
            <p className="text-sm mt-1">
              {result.error}
            </p>
          )}

        </div>

      </div>
    )
  }

  // ---------------------------------------------------------------
  // PRINT / SAVE PDF
  // ---------------------------------------------------------------

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      id="printable-report"
      className="mt-10 printable-report"
    >

      {/* ----------------------------------------------------------- */}
      {/* REPORT HEADER */}
      {/* ----------------------------------------------------------- */}

      <div className="flex items-start justify-between gap-4 mb-4">

        <div>

          <h2 className="text-lg font-semibold text-slate-800">
            {name
              ? `${name}'s Risk Report`
              : "Risk Report"}
          </h2>

          {patientAge !==
            undefined &&
            patientAge !== null &&
            patientAge !== "" && (
              <p className="text-xs text-slate-500 mt-1">
                Age: {patientAge}
              </p>
            )}

          {createdAt && (
            <p className="text-xs text-slate-400 mt-1">
              Report Date:{" "}
              {new Date(
                createdAt
              ).toLocaleString()}
            </p>
          )}

        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="no-print bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-900 transition-colors whitespace-nowrap"
        >
          Print / Save PDF
        </button>

      </div>

      {/* ----------------------------------------------------------- */}
      {/* SUMMARY */}
      {/* ----------------------------------------------------------- */}

      {result.summary && (
        <div className="bg-slate-800 text-white rounded-md p-4 mb-4">

          <p className="text-sm text-slate-300">
            Highest Risk
          </p>

          <p className="font-medium">
            {result.summary.highest_risk_disease}
            {" — "}
            {result.summary.highest_risk_category}
          </p>

        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* DISEASE RESULTS */}
      {/* ----------------------------------------------------------- */}

      {Object.values(
        result.results
      ).map((riskResult, index) => (

        <div
          key={
            riskResult.disease ||
            `disease-${index}`
          }
          className={`border rounded-md p-4 mb-3 ${
            categoryStyle[
              riskResult.risk_category
            ] ||
            "bg-white border-stone-300 text-slate-800"
          }`}
        >

          {/* ------------------------------------------------------- */}
          {/* DISEASE NAME */}
          {/* ------------------------------------------------------- */}

          <p className="font-medium">
            {riskResult.disease}
          </p>

          {/* ------------------------------------------------------- */}
          {/* PROBABILITY */}
          {/* ------------------------------------------------------- */}

          <p className="text-sm mt-1">
            Probability:{" "}
            {typeof riskResult.probability ===
            "number"
              ? (
                  riskResult.probability *
                  100
                ).toFixed(1)
              : "N/A"}
            %
          </p>

          {/* ------------------------------------------------------- */}
          {/* CATEGORY */}
          {/* ------------------------------------------------------- */}

          <p className="text-sm">
            Risk Category:{" "}
            {riskResult.risk_category ||
              "N/A"}
          </p>

          {/* ------------------------------------------------------- */}
          {/* DATA COMPLETENESS */}
          {/* ------------------------------------------------------- */}

          {typeof riskResult.data_completeness ===
            "number" && (
            <p className="text-xs mt-2 opacity-70">
              Data completeness:{" "}
              {riskResult.data_completeness.toFixed(
                1
              )}
              %
            </p>
          )}

          {/* ------------------------------------------------------- */}
          {/* ESTIMATED FIELDS */}
          {/* ------------------------------------------------------- */}

          {riskResult.estimated_fields &&
            riskResult.estimated_fields.length >
              0 && (
              <div className="mt-2">

                <p className="text-xs font-medium">
                  Estimated fields:
                </p>

                <p className="text-xs mt-1 opacity-75">
                  {riskResult.estimated_fields.join(
                    ", "
                  )}
                </p>

              </div>
            )}

          {/* ------------------------------------------------------- */}
          {/* DISCLAIMER */}
          {/* ------------------------------------------------------- */}

          {riskResult.disclaimer && (
            <p className="text-xs mt-2 italic">
              {riskResult.disclaimer}
            </p>
          )}

        

          {/* ------------------------------------------------------- */}
          {/* SHAP EXPLANATION */}
          {/* ------------------------------------------------------- */}

          {riskResult.explanation
            ?.top_factors
            ?.length > 0 && (

            <div className="mt-3 pt-3 border-t border-current/20">

              <p className="text-xs font-medium mb-2">
                Top Contributing Factors
              </p>

              <div className="space-y-2">

                {(() => {
                  const factors =
                    riskResult
                      .explanation
                      .top_factors

                  const impactValues =
                    factors
                      .map(factor =>
                        Math.abs(
                          Number(
                            factor.impact
                          ) || 0
                        )
                      )

                  const maxImpact =
                    Math.max(
                      ...impactValues,
                      0.000001
                    )

                  return factors.map(
                    (factor, factorIndex) => {

                      const impact =
                        Math.abs(
                          Number(
                            factor.impact
                          ) || 0
                        )

                      const percentage =
                        Math.min(
                          100,
                          (
                            impact /
                            maxImpact
                          ) * 100
                        )

                      const increased =
                        factor.direction ===
                        "increased"

                      return (
                        <div
                          key={
                            factorIndex
                          }
                          className="flex items-center gap-2 text-xs"
                        >

                          <span
                            className={
                              increased
                                ? "text-rose-600"
                                : "text-emerald-600"
                            }
                          >
                            {increased
                              ? "▲"
                              : "▼"}
                          </span>

                          <span className="w-36 truncate flex-shrink-0">
                            {factor.feature}
                          </span>

                          <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">

                            <div
                              className={`h-full rounded-full ${
                                increased
                                  ? "bg-rose-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${percentage}%`
                              }}
                            />

                          </div>

                        </div>
                      )
                    }
                  )
                })()}

              </div>

            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* AI EXPLANATION */}
          {/* ------------------------------------------------------- */}

          {riskResult.ai_explanation && (
            <div className="mt-3 pt-3 border-t border-current/20">

              <p className="text-sm font-semibold text-slate-800 mb-2">
                AI Explanation & Recommendations
              </p>

              <MarkdownLite
                text={
                  riskResult.ai_explanation
                }
              />

              {/* --------------------------------------------------- */}
              {/* EVIDENCE SOURCES */}
              {/* --------------------------------------------------- */}

              {riskResult.evidence_sources &&
                riskResult
                  .evidence_sources
                  .length > 0 && (

                  <div className="mt-4 pt-3 border-t border-current/10">

                    <p className="text-xs font-medium">
                      Evidence Sources
                    </p>

                    <ul className="text-xs mt-1 space-y-1">

                      {riskResult
                        .evidence_sources
                        .map(
                          (
                            source,
                            sourceIndex
                          ) => (
                            <li
                              key={
                                sourceIndex
                              }
                              className="list-disc ml-4"
                            >
                              {source}
                            </li>
                          )
                        )}

                    </ul>

                  </div>
                )}

            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* AI EXPLANATION MISSING */}
          {/* ------------------------------------------------------- */}

          {!riskResult.ai_explanation && (
            <div className="mt-3 pt-3 border-t border-current/20">

              <p className="text-xs text-slate-600">
                AI explanation is not available
                for this report.
              </p>

            </div>
          )}

        </div>
      ))}

      {/* ----------------------------------------------------------- */}
      {/* FINAL DISCLAIMER */}
      {/* ----------------------------------------------------------- */}

      <div className="mt-5 p-4 bg-white border border-stone-200 rounded-md">

        <p className="text-xs text-slate-500">
          This report is generated using machine-learning
          predictions and AI-assisted medical information.
          It is not a medical diagnosis. Please consult a
          qualified healthcare professional for medical
          advice, diagnosis, or treatment.
        </p>

      </div>

    </div>
  )
}

export default App