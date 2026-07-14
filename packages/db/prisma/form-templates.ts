/**
 * The 6 canonical form templates, pulled verbatim from the production API
 * (bin-tracking-xdux.onrender.com) that the legacy app reads, deduplicated by title.
 * Seeded by seed.local.ts so the local app shows the same forms in the same format.
 */
export const FORM_TEMPLATES = [
  {
    "title": "Daily Bin Form",
    "description": null,
    "stage": "KILL_FLOOR",
    "formType": "standard",
    "sortOrder": 0,
    "schema": {
      "formType": "standard",
      "sections": [
        {
          "id": "condition_check",
          "title": "Condition Check",
          "fields": [
            {
              "id": "lid_properly",
              "type": "radio",
              "label": "lid properly?",
              "options": [
                "Yes",
                "No"
              ],
              "required": false
            },
            {
              "id": "odar_level",
              "type": "text",
              "label": "odar level =",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "temparature",
              "type": "text",
              "label": "Temparature =",
              "required": false,
              "voiceEnabled": true
            }
          ]
        },
        {
          "id": "notes",
          "title": "Notes",
          "fields": [
            {
              "id": "notes_content",
              "type": "textarea",
              "label": "Notes",
              "required": false,
              "voiceEnabled": true
            }
          ]
        },
        {
          "id": "action_required",
          "title": "Action Required",
          "fields": [
            {
              "id": "action_req",
              "type": "radio",
              "label": "Action req =",
              "options": [
                "Yes",
                "No"
              ],
              "required": false
            }
          ]
        },
        {
          "id": "follow_up",
          "title": "Follow Up",
          "fields": [
            {
              "id": "follow_up_date",
              "type": "date",
              "label": "Follow up date =",
              "required": false
            }
          ],
          "showIf": {
            "values": [
              "Yes"
            ],
            "fieldId": "action_req"
          }
        }
      ]
    }
  },
  {
    "title": "Est 183 Feeding and Watering Livestock",
    "description": "Monitoring Procedures: Visually inspect pens/gates/rails/chutes, walls, floor, drains to confirm good condition and cleanliness prior to animals arriving at the facility. When animals arrive confirm that welfare conditions are met √ - satisfactory conditions, X - unsatisfactory conditions, document in deviation section or Deviation Log.",
    "stage": "KILL_FLOOR",
    "formType": "standard",
    "sortOrder": 1,
    "schema": {
      "formType": "standard",
      "sections": [
        {
          "id": "monitoring_log",
          "title": null,
          "fields": [],
          "tableColumns": [
            {
              "id": "date",
              "type": "date",
              "label": "Date",
              "required": false
            },
            {
              "id": "species",
              "type": "text",
              "label": "Species",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "number_of_animals",
              "type": "number",
              "label": "Number of animals",
              "required": false
            },
            {
              "id": "no_damage_debris_sharp_edges",
              "type": "yes_no",
              "label": "No damage, debris, sharp edges that could cause injury",
              "required": false
            },
            {
              "id": "cleanliness_of_pens_equip",
              "type": "yes_no",
              "label": "Cleanliness of pens & equip",
              "required": false
            },
            {
              "id": "lighting_ventilation_functioning",
              "type": "yes_no",
              "label": "Lighting & ventilation functioning",
              "required": false
            },
            {
              "id": "welfare_conditions",
              "type": "yes_no",
              "label": "Welfare conditions",
              "required": false
            },
            {
              "id": "water_provided",
              "type": "yes_no",
              "label": "Water provided",
              "required": false
            },
            {
              "id": "record_time",
              "type": "time",
              "label": "Record time",
              "required": false
            },
            {
              "id": "feed_bedding",
              "type": "text",
              "label": "Feed & bedding",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "comments",
              "type": "textarea",
              "label": "Comments",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "initials",
              "type": "text",
              "label": "Initials",
              "required": false,
              "voiceEnabled": true
            }
          ]
        },
        {
          "id": "deviations",
          "title": "Deviations: document actions taken below or complete a separate Deviation Log",
          "fields": [],
          "tableColumns": [
            {
              "id": "date_0",
              "type": "date",
              "label": "Date",
              "required": false
            },
            {
              "id": "description_of_deviation_cause",
              "type": "textarea",
              "label": "Description of deviation / cause",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "corrective_actions",
              "type": "textarea",
              "label": "Corrective Actions",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "planned_completion_date",
              "type": "date",
              "label": "Planned completion date",
              "required": false
            },
            {
              "id": "verify_ca",
              "type": "text",
              "label": "Verify CA",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "initials_5",
              "type": "text",
              "label": "Initials",
              "required": false,
              "voiceEnabled": true
            }
          ]
        },
        {
          "id": "verification",
          "title": "Verification: X/Month record review and X2/Year onsite observations by Plant Manager or designate",
          "fields": [
            {
              "id": "date_record_review",
              "type": "date",
              "label": "Date Record Review:",
              "required": false
            },
            {
              "id": "initials_record_review",
              "type": "text",
              "label": "Initials:",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "date_onsite",
              "type": "date",
              "label": "Date onsite:",
              "required": false
            },
            {
              "id": "initials_onsite",
              "type": "text",
              "label": "Initials:",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "verification_date",
              "type": "date",
              "label": "Date",
              "required": false
            },
            {
              "id": "describe_deviation_cause",
              "type": "textarea",
              "label": "Describe deviation/cause",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "corrective_actions_planned_completion_date",
              "type": "textarea",
              "label": "Corrective Actions / Planned Completion Date",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "verify_ca_7",
              "type": "text",
              "label": "Verify CA",
              "required": false,
              "voiceEnabled": true
            },
            {
              "id": "verification_initials",
              "type": "text",
              "label": "Initials",
              "required": false,
              "voiceEnabled": true
            }
          ]
        }
      ]
    }
  },
  {
    "title": "Plant Receiving Record — Meat & Non-Meat",
    "description": "Document all product and supplier information for each delivery received.",
    "stage": "RECEIVING",
    "formType": "repeating",
    "sortOrder": 2,
    "schema": {
      "columns": [
        {
          "id": "date",
          "type": "date",
          "label": "Date",
          "required": true
        },
        {
          "id": "supplier_name",
          "type": "text",
          "label": "Supplier Name",
          "required": true
        },
        {
          "id": "lot_number",
          "type": "text",
          "label": "Supplier / Company Lot #",
          "required": false
        },
        {
          "id": "product_name",
          "type": "text",
          "label": "Product Name",
          "required": true
        },
        {
          "id": "quantity",
          "type": "number",
          "label": "Quantity",
          "required": true
        },
        {
          "id": "product_temp",
          "type": "number",
          "label": "Product Temp (°C)",
          "required": true
        },
        {
          "id": "product_condition",
          "type": "select",
          "label": "Condition of Product",
          "options": [
            "Satisfactory",
            "Unsatisfactory"
          ],
          "required": true
        },
        {
          "id": "truck_temp",
          "type": "number",
          "label": "Truck Temp",
          "required": true
        },
        {
          "id": "truck_condition",
          "type": "select",
          "label": "Condition of Truck",
          "options": [
            "Satisfactory",
            "Unsatisfactory"
          ],
          "required": true
        },
        {
          "id": "comments",
          "type": "textarea",
          "label": "Comments / Corrective Actions",
          "required": false
        },
        {
          "id": "initials",
          "type": "text",
          "label": "Initials",
          "required": true
        }
      ],
      "formType": "repeating",
      "instructions": "1. Inspect the sanitary and structural condition of the transport vehicle. Ensure no objectionable odours, contamination, or temperature abuse. Check: clean and free of contamination; constructed of safe materials; hard, smooth, impervious interior surfaces in good repair.\n2. Check the transport container can maintain 4°C or less for fresh product and -18°C or less for frozen.\n3. If applicable, randomly check the temperature of the product.\n4. Visually evaluate product condition — no contamination, spoilage, damage, temperature abuse, or tampering (open boxes, broken straps, puncture holes)."
    }
  },
  {
    "title": "Allergen Checklist",
    "description": "Supplier allergen declaration — identify allergens present in product, on same line, and in plant.",
    "stage": "RECEIVING",
    "formType": "matrix",
    "sortOrder": 3,
    "schema": {
      "rows": [
        {
          "id": "peanut",
          "label": "Peanut or its derivatives (pieces, protein, oil, butter, flour, mandelona nuts)"
        },
        {
          "id": "tree_nuts",
          "label": "Tree Nuts (almonds, Brazil nuts, cashews, hazelnuts, macadamia, pecans, pine nuts, pistachios, walnuts)"
        },
        {
          "id": "sesame",
          "label": "Sesame or its derivatives (paste, oil)"
        },
        {
          "id": "milk",
          "label": "Milk or its derivatives (caseinate, whey, yogurt powder)"
        },
        {
          "id": "eggs",
          "label": "Eggs or its derivatives (frozen yolk, egg white powder, protein isolates)"
        },
        {
          "id": "fish",
          "label": "Fish or its derivatives (protein, oil, extracts)"
        },
        {
          "id": "crustaceans",
          "label": "Crustaceans & Shellfish (crab, crayfish, lobster, shrimp, clams, mussels, oysters)"
        },
        {
          "id": "soy",
          "label": "Soy or its derivatives (lecithin, oil, tofu, protein isolates)"
        },
        {
          "id": "wheat",
          "label": "Wheat, triticale or derivatives (flour, starches, brans, spelt, durum, kamut)"
        },
        {
          "id": "mustard",
          "label": "Mustard or its derivatives (seeds, flour, ground mustard, prepared mustard)"
        }
      ],
      "columns": [
        {
          "id": "col_product",
          "label": "Present in the product"
        },
        {
          "id": "col_same_line",
          "label": "Present in other products on same line"
        },
        {
          "id": "col_same_plant",
          "label": "Present in same plant"
        }
      ],
      "formType": "matrix",
      "footerFields": [
        {
          "id": "cross_contam_procedures",
          "type": "yes_no",
          "label": "Do you have effective procedures to avoid cross-contamination with allergens not present in the product but noted in columns II and III?",
          "required": true
        }
      ],
      "headerFields": [
        {
          "id": "supplier_name",
          "type": "text",
          "label": "Supplier Name",
          "required": true
        },
        {
          "id": "completed_by",
          "type": "text",
          "label": "Form Completed By",
          "required": true
        },
        {
          "id": "product_name",
          "type": "text",
          "label": "Product Name",
          "required": true
        },
        {
          "id": "product_code",
          "type": "text",
          "label": "Product Code",
          "required": false
        }
      ]
    }
  },
  {
    "title": "Equipment Review Form",
    "description": "Evaluate equipment, instruments, measuring devices, and food contact surfaces against compliance criteria.",
    "stage": "MAINTENANCE",
    "formType": "checklist",
    "sortOrder": 4,
    "schema": {
      "groups": [
        {
          "id": "equipment_group",
          "items": [
            {
              "id": "c9_04_15_01_01",
              "label": "(C9.04.15.01.01) Equipment, instruments and measuring devices are designed in a manner that prevents contamination of meat products."
            },
            {
              "id": "c9_04_15_01_02",
              "label": "(C9.04.15.01.02) Constructed of materials that are corrosion resistant, do not transmit odour or taste, and are free of constituents likely to contaminate meat."
            },
            {
              "id": "c9_04_15_01_03",
              "label": "(C9.04.15.01.03) Located and installed in a manner that prevents contamination of meat products and allows for effective cleaning and sanitizing."
            },
            {
              "id": "c9_04_15_02_01",
              "label": "(C9.04.15.02.01) Each piece of equipment or utensil is effective for its intended purpose."
            }
          ],
          "title": "Equipment, Instruments and Measuring Devices"
        },
        {
          "id": "food_contact",
          "items": [
            {
              "id": "c9_04_15_05_01",
              "label": "(C9.04.15.05.01) They are non-absorbent, corrosion resistant and non-toxic."
            },
            {
              "id": "c9_04_15_05_02",
              "label": "(C9.04.15.05.02) They are designed and constructed to be free of niches for accumulation of food debris and microbial growth."
            },
            {
              "id": "c9_04_15_05_03",
              "label": "(C9.04.15.05.03) They are smooth and free from pitting, cracks and chipping."
            },
            {
              "id": "c9_04_15_05_04",
              "label": "(C9.04.15.05.04) They are capable of withstanding repeated cleaning and sanitizing."
            }
          ],
          "title": "Food Contact Surfaces"
        },
        {
          "id": "shelving",
          "items": [
            {
              "id": "c9_04_15_06_01",
              "label": "(C9.04.15.06.01) Shelves and racks are designed, constructed, located, installed, and maintained to facilitate sanitary operation, with sufficient clearance from floor for cleaning."
            }
          ],
          "title": "Shelving and Racks"
        },
        {
          "id": "inedible",
          "items": [
            {
              "id": "c9_04_15_07_02",
              "label": "(C9.04.15.07.02) All equipment used for inedible material intended for pet food or pharmaceutical use allows hygienic processing, packaging and labelling."
            },
            {
              "id": "c9_04_15_07_03",
              "label": "(C9.04.15.07.03) Equipment for inedible material is in good condition and made of durable materials that can be cleaned and sanitized."
            }
          ],
          "title": "Inedible Equipment"
        },
        {
          "id": "records",
          "items": [
            {
              "id": "rec_01",
              "label": "Operator's manual has been received (includes cleaning, maintenance, and installation instructions)."
            },
            {
              "id": "rec_02",
              "label": "Equipment added to the Maintenance Schedule / Record."
            },
            {
              "id": "rec_03",
              "label": "Equipment added to the Sanitation Schedule."
            },
            {
              "id": "rec_04",
              "label": "Equipment added to the Pre-Operational Inspection."
            },
            {
              "id": "rec_05",
              "label": "Instruments and Measuring Devices added to the Calibration Schedule / Record."
            }
          ],
          "title": "Records"
        }
      ],
      "formType": "checklist",
      "headerFields": [
        {
          "id": "person_responsible",
          "type": "text",
          "label": "Person Responsible",
          "required": true
        },
        {
          "id": "date",
          "type": "date",
          "label": "Date",
          "required": true
        },
        {
          "id": "equipment_name",
          "type": "text",
          "label": "Equipment Name",
          "required": true
        },
        {
          "id": "model_number",
          "type": "text",
          "label": "Model Number",
          "required": false
        },
        {
          "id": "supplier",
          "type": "text",
          "label": "Equipment Supplier / Manufacturer",
          "required": false
        },
        {
          "id": "installation_date",
          "type": "date",
          "label": "Date of Installation or Use",
          "required": false
        },
        {
          "id": "location_purpose",
          "type": "text",
          "label": "Location or Purpose",
          "required": false
        }
      ]
    }
  },
  {
    "title": "Customer Complaint Investigation Form",
    "description": "Record and investigate product or service complaints from customers.",
    "stage": "QUALITY",
    "formType": "standard",
    "sortOrder": 5,
    "schema": {
      "formType": "standard",
      "sections": [
        {
          "id": "header",
          "title": null,
          "fields": [
            {
              "id": "date",
              "type": "date",
              "label": "Date",
              "required": true
            },
            {
              "id": "time",
              "type": "time",
              "label": "Time",
              "required": true
            },
            {
              "id": "complaint_number",
              "type": "text",
              "label": "Complaint Number",
              "required": true
            },
            {
              "id": "initiated_by",
              "type": "text",
              "label": "Initiated By",
              "required": true
            }
          ]
        },
        {
          "id": "section1",
          "title": "Section 1 - Customer Details",
          "fields": [
            {
              "id": "customer_name",
              "type": "text",
              "label": "Customer Name",
              "required": true
            },
            {
              "id": "customer_address",
              "type": "textarea",
              "label": "Customer Address",
              "required": false
            },
            {
              "id": "telephone",
              "type": "text",
              "label": "Telephone Number",
              "required": false
            },
            {
              "id": "fax",
              "type": "text",
              "label": "Fax Number",
              "required": false
            },
            {
              "id": "contact_name",
              "type": "text",
              "label": "Contact Name",
              "required": false
            },
            {
              "id": "email",
              "type": "text",
              "label": "E-Mail Address",
              "required": false
            }
          ]
        },
        {
          "id": "section2",
          "title": "Section 2 - Product Details",
          "fields": [
            {
              "id": "product_name",
              "type": "text",
              "label": "Product Name",
              "required": true
            },
            {
              "id": "product_code",
              "type": "text",
              "label": "Product Code",
              "required": false
            },
            {
              "id": "best_before_date",
              "type": "date",
              "label": "Best Before or Production Date",
              "required": false
            },
            {
              "id": "packaging_type",
              "type": "text",
              "label": "Packaging Type (e.g. MAP, vacuum packaged)",
              "required": false
            },
            {
              "id": "date_of_purchase",
              "type": "date",
              "label": "Date of Purchase or Receipt",
              "required": false
            },
            {
              "id": "location_of_purchase",
              "type": "text",
              "label": "Location of Purchase",
              "required": false
            },
            {
              "id": "amount_affected",
              "type": "text",
              "label": "Amount Affected",
              "required": false
            },
            {
              "id": "amount_remaining",
              "type": "text",
              "label": "Amount Remaining",
              "required": false
            },
            {
              "id": "disposition",
              "type": "textarea",
              "label": "Disposition of the Remaining Product",
              "required": false
            }
          ]
        },
        {
          "id": "section3",
          "title": "Section 3 - Nature of the Complaint",
          "fields": [
            {
              "id": "complaint_type",
              "type": "radio",
              "label": "Please choose one of the following",
              "options": [
                "Out of Spec",
                "Packaging Compromised",
                "Labelling",
                "Off condition",
                "Foreign Material",
                "Taste",
                "Allergic Reaction",
                "Illness or Injury",
                "Other"
              ],
              "required": true
            },
            {
              "id": "other_description",
              "type": "textarea",
              "label": "If Other — Please Describe",
              "required": false
            }
          ]
        },
        {
          "id": "section4",
          "title": "Section 4 - Illness Details",
          "fields": [
            {
              "id": "consumed_when",
              "type": "text",
              "label": "When was the product consumed?",
              "required": false
            },
            {
              "id": "amount_consumed",
              "type": "text",
              "label": "Amount of product consumed",
              "required": false
            },
            {
              "id": "consumed_before",
              "type": "yes_no",
              "label": "Has the product been consumed before?",
              "required": false
            },
            {
              "id": "persons_consuming",
              "type": "number",
              "label": "Number of persons consuming the product",
              "required": false
            },
            {
              "id": "persons_ill",
              "type": "number",
              "label": "Number of persons ill",
              "required": false
            },
            {
              "id": "time_ill",
              "type": "text",
              "label": "Time persons became ill",
              "required": false
            },
            {
              "id": "medical_professional",
              "type": "yes_no",
              "label": "Has a medical professional been consulted?",
              "required": false
            },
            {
              "id": "illness_status",
              "type": "text",
              "label": "Current Status of Illness",
              "required": false
            },
            {
              "id": "persons_ill_names",
              "type": "textarea",
              "label": "Names and Ages of persons ill",
              "required": false
            },
            {
              "id": "symptoms",
              "type": "textarea",
              "label": "Symptoms of illness in order of occurrence",
              "required": false
            },
            {
              "id": "followup_required",
              "type": "yes_no",
              "label": "Any follow-up required?",
              "required": false
            }
          ],
          "showIf": {
            "values": [
              "Allergic Reaction",
              "Illness or Injury"
            ],
            "fieldId": "complaint_type"
          }
        },
        {
          "id": "section5",
          "title": "Section 5 - Injury Details",
          "fields": [
            {
              "id": "injury_nature",
              "type": "textarea",
              "label": "Nature of Injury",
              "required": false
            },
            {
              "id": "injury_status",
              "type": "text",
              "label": "Current Status of Injury",
              "required": false
            },
            {
              "id": "injury_medical",
              "type": "yes_no",
              "label": "Has a medical professional been consulted?",
              "required": false
            },
            {
              "id": "injury_followup",
              "type": "yes_no",
              "label": "Any follow-up required?",
              "required": false
            }
          ],
          "showIf": {
            "values": [
              "Illness or Injury"
            ],
            "fieldId": "complaint_type"
          }
        },
        {
          "id": "section6",
          "title": "Section 6 - Investigation Details",
          "fields": [
            {
              "id": "investigation_date",
              "type": "date",
              "label": "Date",
              "required": false
            },
            {
              "id": "investigation_time",
              "type": "time",
              "label": "Time",
              "required": false
            },
            {
              "id": "completed_by",
              "type": "text",
              "label": "Completed By",
              "required": false
            },
            {
              "id": "onsite_results",
              "type": "textarea",
              "label": "Results of On-Site Investigation",
              "required": false
            },
            {
              "id": "records_results",
              "type": "textarea",
              "label": "Results of Records Review",
              "required": false
            },
            {
              "id": "micro_results",
              "type": "textarea",
              "label": "Results of Micro Review if Required",
              "required": false
            }
          ]
        },
        {
          "id": "section7",
          "title": "Section 7 - Food Safety Assessment",
          "fields": [
            {
              "id": "food_safety_compromised",
              "type": "yes_no",
              "label": "Has food safety been compromised?",
              "required": false
            },
            {
              "id": "other_products_affected",
              "type": "yes_no",
              "label": "Are any other products affected by the complaint?",
              "required": false
            }
          ]
        },
        {
          "id": "section8",
          "title": "Section 8 - Corrective Actions",
          "fields": [
            {
              "id": "immediate_actions",
              "type": "textarea",
              "label": "Immediate Corrective Actions",
              "required": false
            },
            {
              "id": "preventive_measures",
              "type": "textarea",
              "label": "Preventive Measures",
              "required": false
            }
          ]
        },
        {
          "id": "section9",
          "title": "Section 9 - Communication",
          "fields": [
            {
              "id": "referred_to",
              "type": "textarea",
              "label": "Has the complaint been referred to anyone else? (e.g. Public Health, CFIA)",
              "required": false
            },
            {
              "id": "response_sent",
              "type": "date",
              "label": "Date Response sent to Customer",
              "required": false
            }
          ]
        }
      ]
    }
  }
] as const;
