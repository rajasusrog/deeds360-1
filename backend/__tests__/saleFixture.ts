export function buildCompleteSaleState(overrides: Record<string, any> = {}): any {
  const base: any = {
    documentType: 'SALE',
    documentSubType: 'SALE_METRO',
    parties: [
      {
        id: 'party-seller-1',
        role: 'Seller',
        name: 'Ramasamy Mudaliar',
        NameTa: 'ராமசாமி முதலியார்',
        relationType: 'S/o',
        relationName: 'Kandasamy',
        fatherName: 'Kandasamy',
        age: 58,
        pan: 'ABCDE1234F',
        aadhaar: '542198763421',
        mobile: '9840123456',
        phone: '9840123456',
        email: 'seller@example.test',
        address: 'No. 14, North Mada Street, Mylapore, Chennai - 600004',
        sharePercentage: '100%'
      },
      {
        id: 'party-buyer-1',
        role: 'Buyer',
        name: 'Lakshmi Narayanan',
        NameTa: 'லட்சுமி நாராயணன்',
        relationType: 'S/o',
        relationName: 'Sundaram',
        fatherName: 'Sundaram',
        age: 42,
        pan: 'PQRSX5678K',
        aadhaar: '674321985432',
        mobile: '9840654321',
        phone: '9840654321',
        email: 'buyer@example.test',
        address: 'No. 28, Luz Church Road, Mylapore, Chennai - 600004',
        sharePercentage: '100%'
      }
    ],
    property: {
      district: 'Chennai',
      registrationDistrict: 'Chennai Central',
      taluk: 'Mylapore',
      sro: 'Mylapore',
      village: 'Mylapore',
      localBodyType: 'Corporation',
      localBodyName: 'Greater Chennai Corporation',
      landType: 'Residential Plot',
      LayoutName: 'Kapaleeswarar Nagar',
      plotNo: '42',
      doorNo: '14A',
      streetName: 'North Mada Street',
      wardNo: '124',
      pincode: '600004'
    },
    survey: {
      surveyType: 'Town Survey',
      surveyNo: '412',
      subDivision: '2B',
      oldSurveyNo: '210',
      pattaNo: '8841',
      chittaRef: 'CH/2026/8841',
      areaValue: 2400,
      areaUnit: 'sq.ft',
      areaSqFt: 2400,
      areaSqMeters: 222.97,
      areaCents: 5.51
    },
    surveys: [
      {
        id: 'srv-1',
        surveyType: 'Town Survey',
        surveyNo: '412',
        subDivision: '2B',
        oldSurveyNo: '210',
        pattaNo: '8841',
        chittaRef: 'CH/2026/8841',
        areaValue: 1400,
        areaUnit: 'sq.ft',
        areaSqFt: 1400,
        areaSqMeters: 130.06,
        areaCents: 3.21
      },
      {
        id: 'srv-2',
        surveyType: 'Town Survey',
        surveyNo: '413',
        subDivision: '1A',
        oldSurveyNo: '211',
        pattaNo: '8842',
        chittaRef: 'CH/2026/8842',
        areaValue: 1000,
        areaUnit: 'sq.ft',
        areaSqFt: 1000,
        areaSqMeters: 92.9,
        areaCents: 2.3
      }
    ],
    extent: {
      totalExtent: 2400,
      sqft: 2400,
      acre: 0.055,
      cent: 5.51,
      hectare: 0.022,
      eastWest: '40',
      northSouth: '60'
    },
    boundary: {
      north: '30 Feet Layout Road',
      south: 'Plot No. 43 belonging to Murugan',
      east: 'Plot No. 41 belonging to Sivakumar',
      west: 'Common Passage'
    },
    boundaries: {
      north: '30 Feet Layout Road',
      south: 'Plot No. 43 belonging to Murugan',
      east: 'Plot No. 41 belonging to Sivakumar',
      west: 'Common Passage',
      eastToWestNorth: '40',
      eastToWestSouth: '40',
      northToSouthEast: '60',
      northToSouthWest: '60',
      accessRoadWidth: '30 Feet',
      linearUnit: 'feet'
    },
    ownershipHistory: {
      howAcquired: 'Purchase',
      parentDocNo: '1988/2015',
      parentDocYear: '2015',
      parentDocType: 'Sale Deed',
      parentDocSRO: 'Mylapore',
      parentSro: 'Mylapore',
      parentDocDate: '2015-05-10',
      priorOwners: 'Subramaniam Chettiar',
      ecNumber: 'EC/2026/99210',
      ecPeriodFrom: '1995-01-01',
      ecPeriodTo: '2026-03-01',
      encumbranceStatus: 'Nil Encumbrance'
    },
    transaction: {
      guidelineRatePerSqFt: 4500,
      guidelineValue: 10800000,
      marketValue: 12000000,
      considerationAmount: 12000000,
      paymentMode: 'NEFT/RTGS',
      bankName: 'State Bank of India, Mylapore Branch',
      paymentRefNo: 'SBINR520260315998811',
      utrNumber: 'SBINR520260315998811',
      paymentDate: '2026-03-15',
      advancePaid: 2000000,
      balancePaid: 10000000,
      stampDutyPercent: 7,
      registrationFeePercent: 4,
      stampDutyAmount: 840000,
      registrationFeeAmount: 480000,
      otherCharges: 1500,
      totalPayable: 1321500,
      payments: [
        {
          id: 'pay-1',
          mode: 'RTGS',
          amount: 12000000,
          date: '2026-03-15',
          bankName: 'State Bank of India',
          referenceNo: 'SBINR520260315998811',
          Stage: 'Full Settlement'
        }
      ]
    },
    building: {
      hasBuilding: false,
      buildingType: 'RCC Posh',
      plinthAreaSqFt: 0,
      floorsCount: 0,
      ageOfBuilding: 0,
      buildingDoorNo: '',
      ebServiceNo: '',
      waterConnectionNo: '',
      propertyTaxAssessmentNo: '',
      buildingValue: 0
    },
    witnesses: [
      {
        id: 'wit-1',
        name: 'Karthikeyan V',
        relationName: 'Velmurugan',
        fatherName: 'Velmurugan',
        aadhaar: '782345129087',
        mobile: '9840112233',
        phone: '9840112233',
        address: 'No. 8, South Mada Street, Mylapore, Chennai - 600004'
      },
      {
        id: 'wit-2',
        name: 'Senthamarai S',
        relationName: 'Subramanian',
        fatherName: 'Subramanian',
        aadhaar: '891234765012',
        mobile: '9840445566',
        phone: '9840445566',
        address: 'No. 22, East Mada Street, Mylapore, Chennai - 600004'
      }
    ],
    specialConditions: {
      possessionHandover: 'Immediate on Registration',
      taxArrearsClearence: 'Seller clears all up to date',
      indemnityClauseIncluded: true,
      disputeResolutionCity: 'Chennai',
      customConditions: ''
    },
    languageMode: 'EN',
    ...overrides
  };

  return JSON.parse(JSON.stringify(base));
}

