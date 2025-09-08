const express = require("express");
const https = require("https");
const router = express.Router();
const cron = require("node-cron");
const FuelPrice = require("../models/FuelPrice");

// List of specific cities we want data for
const TARGET_CITIES = [
  "Chennai",
  "Coimbatore",
  "Madurai",
  "Tiruchirappalli",
  "Salem",
];

// Enhanced mock data for demonstration
const MOCK_DATA = [
  { city: "Chennai", petrol: "102.34", diesel: "94.56", cng: "72.50" },
];

// Function to fetch data for a single city
const fetchCityData = (cityName) => {
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      hostname:
        "daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com",
      port: null,
      path: `/v1/fuel-prices/today/india/tamil-nadu/${encodeURIComponent(
        cityName.toLowerCase()
      )}`,
      headers: {
        "x-rapidapi-key": "2d6e04fb84mshfd6f47b7db0346bp16c457jsn93343ccec875",
        "x-rapidapi-host":
          "daily-petrol-diesel-lpg-cng-fuel-prices-in-india.p.rapidapi.com",
      },
      timeout: 10000,
    };

    const apiRequest = https.request(options, (apiResponse) => {
      let data = "";
      let contentType = apiResponse.headers["content-type"] || "";

      // Check if response is HTML (indicating an error)
      if (contentType.includes("text/html")) {
        reject(new Error("API returned HTML instead of JSON"));
        return;
      }

      apiResponse.on("data", (chunk) => {
        data += chunk;
      });

      apiResponse.on("end", () => {
        try {
          // Check if response starts with HTML tags
          if (
            data.trim().startsWith("<!DOCTYPE") ||
            data.trim().startsWith("<html")
          ) {
            reject(new Error("API returned HTML instead of JSON"));
            return;
          }

          const parsedData = JSON.parse(data);

          // Check for API error messages
          if (parsedData.message) {
            reject(new Error(parsedData.message));
            return;
          }

          resolve(parsedData);
        } catch (error) {
          reject(new Error("Failed to parse API response as JSON"));
        }
      });
    });

    apiRequest.on("error", (error) => {
      reject(error);
    });

    apiRequest.on("timeout", () => {
      apiRequest.destroy();
      reject(new Error("API request timed out"));
    });

    apiRequest.end();
  });
};

// Function to fetch and store data for all target cities
const fetchAndStoreAllData = async () => {
  try {
    const currentDate = new Date();
    const dateKey = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const citiesData = [];

    for (const city of TARGET_CITIES) {
      try {
        const cityData = await fetchCityData(city);

        if (cityData && cityData.fuel) {
          citiesData.push({
            city: cityData.cityName,
            petrol: cityData.fuel.petrol?.retailPrice ?? 0,
            diesel: cityData.fuel.diesel?.retailPrice ?? 0,
            cng: cityData.fuel.cng ? cityData.fuel.cng.retailPrice : null,
            lastUpdated: currentDate,
          });

          console.log(`✅ Collected ${cityData.cityName}`);
        }
      } catch (cityError) {
        console.log(`❌ API request for ${city} failed:`, cityError.message);
        
        // Try to use mock data as fallback for this city
        const mockCity = MOCK_DATA.find(c => c.city.toLowerCase() === city.toLowerCase());
        if (mockCity) {
          citiesData.push({
            ...mockCity,
            lastUpdated: currentDate,
          });
          console.log(`✅ Used mock data for ${city}`);
        }
      }
    }

    if (citiesData.length > 0) {
      // Upsert one document for today's date
      await FuelPrice.updateOne(
        { date: dateKey, state: "Tamil Nadu" },
        { $set: { cities: citiesData } },
        { upsert: true }
      );
      
      console.log(`✅ Successfully stored data for ${dateKey}`);
      return { success: true, date: dateKey, citiesCount: citiesData.length };
    } else {
      console.log(`❌ No data collected for ${dateKey}`);
      return { success: false, message: "No data collected" };
    }
  } catch (error) {
    console.error("Unexpected error in fetchAndStoreAllData:", error);
    return { success: false, error: error.message };
  }
};

// Schedule the cron job to run daily at 9:00 AM
// You can adjust the schedule as needed (e.g., "0 9 * * *" for 9 AM daily)
cron.schedule("0 9 * * *", async () => {
  console.log("⏰ Running scheduled fuel price update...");
  const result = await fetchAndStoreAllData();
  console.log("Cron job result:", result);
});

// Manual trigger endpoint for testing or immediate updates
router.post("/trigger-update", async (req, res) => {
  try {
    console.log("🔵 Manually triggering fuel price update...");
    const result = await fetchAndStoreAllData();
    
    res.json({
      success: result.success,
      message: result.success ? 
        `Successfully updated ${result.citiesCount} cities for ${result.date}` : 
        "Failed to update fuel prices",
      date: result.date,
      citiesCount: result.citiesCount,
      error: result.error
    });
  } catch (error) {
    console.error("Error in manual trigger:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger update",
      error: error.message
    });
  }
});

// GET fuel prices for specific cities in Tamil Nadu (now just returns stored data)
router.get("/tamilnadu", async (req, res) => {
  try {
    const currentDate = new Date();
    const dateKey = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // Return today's stored data
    const storedData = await FuelPrice.findOne({
      date: dateKey,
      state: "Tamil Nadu",
    }).select("date state cities -_id");

    if (storedData) {
      return res.json({
        success: true,
        source: "database",
        message: "Using stored fuel prices data",
        lastUpdated: currentDate,
        data: storedData,
      });
    } else {
      // fallback to mock data
      const mockDataWithDate = MOCK_DATA.map((city) => ({
        ...city,
        lastUpdated: currentDate,
      }));

      return res.json({
        success: true,
        source: "mock",
        message: "Using mock data as fallback",
        lastUpdated: currentDate,
        data: {
          date: dateKey,
          state: "Tamil Nadu",
          cities: mockDataWithDate,
        },
      });
    }
  } catch (error) {
    console.error("Unexpected error:", error);

    // final fallback
    const mockDataWithDate = MOCK_DATA.map((city) => ({
      ...city,
      lastUpdated: new Date(),
    }));

    return res.json({
      success: true,
      source: "mock",
      message: "Using mock data as final fallback",
      lastUpdated: new Date(),
      data: {
        date: new Date().toISOString().split("T")[0],
        state: "Tamil Nadu",
        cities: mockDataWithDate,
      },
    });
  }
});

// Other routes remain the same as previous implementation
// GET all stored fuel prices for target cities (date-wise)
router.get("/stored", async (req, res) => {
  try {
    const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const data = await FuelPrice.findOne({
      state: "Tamil Nadu",
      date: dateKey,
    }).select("date state cities -_id");

    if (!data) {
      return res.status(404).json({
        success: false,
        message: `No stored data found for ${dateKey}`,
      });
    }

    // Filter only target cities
    const filteredCities = data.cities.filter((c) =>
      TARGET_CITIES.map((t) => t.toLowerCase()).includes(c.city.toLowerCase())
    );

    res.json({
      success: true,
      count: filteredCities.length,
      date: data.date,
      cities: filteredCities,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve stored data",
      error: error.message,
    });
  }
});

// GET fuel prices for a specific target city (date-wise)
router.get("/city/:cityName", async (req, res) => {
  try {
    const cityName = decodeURIComponent(req.params.cityName);
    const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Check if requested city is in our target list
    if (
      !TARGET_CITIES.map((c) => c.toLowerCase()).includes(
        cityName.toLowerCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `Data for ${cityName} is not available. Available cities: ${TARGET_CITIES.join(
          ", "
        )}`,
      });
    }

    // Try fetching from database first
    const data = await FuelPrice.findOne({
      date: dateKey,
      state: "Tamil Nadu",
    }).select("cities -_id");

    const cityData = data?.cities.find(
      (c) => c.city.toLowerCase() === cityName.toLowerCase()
    );

    if (cityData) {
      return res.json({
        success: true,
        source: "database",
        city: cityData,
      });
    }

    // If not in database, try to fetch fresh data
    try {
      const freshData = await fetchCityData(cityName);

      if (freshData && freshData.fuel) {
        const cityEntry = {
          city: freshData.cityName,
          petrol: freshData.fuel.petrol?.retailPrice ?? 0,
          diesel: freshData.fuel.diesel?.retailPrice ?? 0,
          cng: freshData.fuel.cng ? freshData.fuel.cng.retailPrice : null,
          lastUpdated: new Date(),
        };

        // Store this single city data
        await FuelPrice.updateOne(
          { date: dateKey, state: "Tamil Nadu" },
          { 
            $set: { date: dateKey, state: "Tamil Nadu" },
            $addToSet: { cities: cityEntry }
          },
          { upsert: true }
        );

        return res.json({
          success: true,
          source: "api",
          city: cityEntry,
        });
      }
    } catch (apiError) {
      console.log(`API request for ${cityName} failed:`, apiError.message);
    }

    // If API failed, fallback to mock data
    const mockCity = MOCK_DATA.find(
      (c) => c.city.toLowerCase() === cityName.toLowerCase()
    );

    if (mockCity) {
      return res.json({
        success: true,
        source: "mock",
        city: { ...mockCity, lastUpdated: new Date() },
      });
    }

    return res.status(404).json({
      success: false,
      message: `Fuel price data for ${cityName} not found`,
    });
  } catch (error) {
    console.error("City lookup error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// GET list of available target cities
router.get("/cities", async (req, res) => {
  try {
    res.json({
      success: true,
      cities: TARGET_CITIES.sort(),
    });
  } catch (error) {
    console.error("Cities list error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
