import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { setGlobalDispatcher, Agent } from "undici";

// Configure Node global fetch timeout to 5 minutes (300,000ms)
setGlobalDispatcher(new Agent({ headersTimeout: 300000, bodyTimeout: 300000 }));

const app = express();
const PORT = 3000;

// Setup JSON body parsing limit for large base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Google Gen AI safely
let ai: GoogleGenAI | null = null;
function getGenAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please set it in the Settings secrets.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 300000, // 5 minutes
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return ai;
}

// AI Image OCR / Data Extraction API Endpoint
app.post("/api/ocr-label", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "Yêu cầu hình ảnh không được để trống." });
      return;
    }

    // Parse base64 and mimeType
    let base64Data = image;
    let mimeType = "image/jpeg";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const genAIClient = getGenAI();
    // Sử dụng Gemini 3.1 Flash Lite tối ưu và nhanh chóng
    const response = await genAIClient.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            }
          },
          {
            text: "Bạn là một chuyên gia phân tích nhãn hóa chất và hộp thử nghiệm phòng xét nghiệm (Sinh hóa, Huyết học, Miễn dịch) theo chuẩn ISO 15189. " +
                  "Vui lòng đọc hình ảnh này và bóc tách các thông tin cụ thể: Tên hóa chất/QC, Số Lô (LOT), Hạn sử dụng (EXP Date), và Hãng sản xuất. " +
                  "Trả về định dạng JSON chính xác theo cấu trúc được yêu cầu."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "Tên hóa chất hoặc vật tư hoặc dung dịch chuẩn Calibrator/QC. Để trống nếu không tìm thấy."
            },
            lotNumber: {
              type: Type.STRING,
              description: "Số lô (LOT). Trích xuất mã số lô chính xác. Để trống nếu không tìm thấy."
            },
            originalExpiryDate: {
              type: Type.STRING,
              description: "Hạn sử dụng chuyển đổi sang định dạng chuẩn YYYY-MM-DD. Nếu chỉ tìm thấy MM/YYYY hoặc MM-YYYY, trả về ngày cuối cùng của tháng đó (Ví dụ: 12/2026 -> 2026-12-31, 08/2027 -> 2027-08-31). Để trống nếu không tìm thấy."
            },
            manufacturer: {
              type: Type.STRING,
              description: "Tên hãng sản xuất (Ví dụ: Roche, Abbott, Bio-Rad, Sysmex, Siemens, Beckman Coulter). Để trống nếu không tìm thấy."
            }
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      res.status(500).json({ error: "Không nhận được phản hồi từ mô hình AI." });
      return;
    }

    const parsedData = JSON.parse(textOutput.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Lỗi xử lý OCR nhãn hóa chất:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi phân tích hình ảnh." });
  }
});

// AI Spec Table Test Extraction API Endpoint
app.post("/api/analyze-spec-table", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "Yêu cầu hình ảnh không được để trống." });
      return;
    }

    // Parse base64 and mimeType
    let base64Data = image;
    let mimeType = "image/jpeg";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const genAIClient = getGenAI();
    // Sử dụng Gemini 3.1 Flash Lite tối ưu và nhanh chóng
    const response = await genAIClient.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            }
          },
          {
            text: "Bạn là một chuyên gia phân tích tài liệu và bảng thông số kỹ thuật (Spec Table / Target Sheet / Control Sheet) của nhà sản xuất hóa chất, dung dịch kiểm chuẩn QC và Calibrator phòng xét nghiệm y khoa. " +
                  "Vui lòng quét hình ảnh này và trích xuất danh sách tất cả các chỉ số xét nghiệm (Tests / Analytes) được liệt kê trong bảng. " +
                  "Ví dụ các chỉ số phổ biến: Glucose, AST (GOT), ALT (GPT), Urea, Creatinine, HBsAg, HIV, HCV, Troponin, Cholesterol, Triglycerides, Bilirubin, Albumin, Protein, TSH, FT3, FT4, CRP, Na+, K+, Cl-, Ca++, WBC, RBC, HGB, PLT... " +
                  "Hãy tìm kiếm tất cả các tên viết tắt hoặc tên đầy đủ của các test có trong tài liệu và trả về một mảng JSON các tên test được chuẩn hóa ngắn gọn (ví dụ: ['Glucose', 'AST', 'ALT', 'Creatinine']). " +
                  "Chú ý chỉ trả về các test thực sự có thông số hiển thị trên bảng."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedTests: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Danh sách tên các chỉ số xét nghiệm/test tìm thấy được chuẩn hóa viết tắt/ngắn gọn."
            }
          },
          required: ["extractedTests"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      res.status(500).json({ error: "Không nhận được phản hồi từ mô hình AI." });
      return;
    }

    const parsedData = JSON.parse(textOutput.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Lỗi xử lý phân tích bảng thông số:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi phân tích hình ảnh bảng thông số." });
  }
});

// Endpoint phân tích báo cáo kết quả QC hàng ngày (PDF / Hình ảnh)
app.post("/api/parse-qc-pdf", async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData) {
      res.status(400).json({ error: "Dữ liệu tệp không được để trống." });
      return;
    }

    // Parse base64 and mimeType
    let base64Data = fileData;
    let targetMimeType = mimeType || "application/pdf";
    if (fileData.startsWith("data:")) {
      const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        targetMimeType = match[1];
        base64Data = match[2];
      }
    }

    const genAIClient = getGenAI();
    const response = await genAIClient.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: targetMimeType,
          }
        },
        {
          text: "Bạn là một trợ lý AI chuyên nghiệp trong Lab xét nghiệm y khoa (chuẩn ISO 15189 / Quyết định 2429/QĐ-BYT).\n" +
                "Vui lòng đọc tài liệu 'BÁO CÁO KẾT QUẢ QC HÀNG NGÀY' (PDF hoặc Hình ảnh) này và trích xuất tất cả các dòng kết quả chạy QC.\n" +
                "Hãy phân tích thật kỹ bảng kết quả kiểm chuẩn có các cột: TG chạy, Tên máy XN, Xét nghiệm, Kết quả, Level, Trung bình, Độ lệch chuẩn, Accept, Warning, Reject, Luật (Rules), Luật trên Lô, Xử lý.\n\n" +
                "Hướng dẫn bóc tách:\n" +
                "1. testName: Lấy tên xét nghiệm từ cột 'Xét nghiệm' (ví dụ: 'HbA1C', 'Cl-', 'K+', 'Na+', 'Urê', 'Triglycerid', 'Sắt', 'Glucose', 'GGT', 'Creatinin', 'Cholesterol', 'Lactat', 'LDH', 'Amylase', 'ALT (GPT)', 'AST (GOT)', 'Magiê', 'Calci', 'Acid Uric', 'Albumine', 'Protein T.P', 'Bilirubin T.T', 'Bilirubin T.P', 'Cồn trong máu').\n" +
                "2. machineName: Lấy tên máy xét nghiệm viết tắt chính xác trong cột 'Tên máy XN' (ví dụ: 'AU 680_2', 'Electalyte 500', 'Atellica Ci1900').\n" +
                "3. category: Chỉ chọn một trong các phân khoa: 'Sinh hóa', 'Huyết học', 'Miễn dịch'. Hầu hết các chất trên máy AU680, Atellica, Electalyte như Glucose, ALT, AST, GGT, Urea, Creatinin, Bilirubin, Điện giải đồ, HbA1C, Lactat, Sắt... đều thuộc phân khoa 'Sinh hóa'.\n" +
                "4. level: Mức QC (ví dụ: 'Level 1', 'Level 2', 'Level 3'). Chuyển đổi số 1, 2, 3 thành định dạng 'Level X'.\n" +
                "5. value: Kết quả đo đo được (số thực, ví dụ: 14.4).\n" +
                "6. mean: Giá trị trung bình (Trung bình) trong bảng (ví dụ: 14.50).\n" +
                "7. sd: Độ lệch chuẩn (Độ lệch chuẩn) trong bảng (ví dụ: 1.00).\n" +
                "8. status: Trạng thái QC. CHỈ dựa vào cột 'Accept': nếu cột 'Accept' được tích chọn (ví dụ ký hiệu þ hoặc có dấu [x]), thì trả về 'Passed' (Đạt). Nếu cột 'Accept' KHÔNG được tích chọn (ví dụ ký hiệu ¨ hoặc ô trống), trả về 'Warning' (Có lỗi).\n" +
                "9. westgardRule: Ghi nhận chính xác quy tắc vi phạm ở cột 'Luật (Rules)' hoặc 'Luật trên Lô' (ví dụ: '10x(W)', '10-x(W)', '1-3s', '2-2s'). Nếu không có dấu tích ở cột 'Accept' (trạng thái là Warning) nhưng hai cột luật này trống, hãy ghi chú 'Vượt dải cho phép / Chưa đạt Accept'."
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            qcResults: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  testName: { type: Type.STRING },
                  machineName: { type: Type.STRING },
                  category: { type: Type.STRING },
                  level: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  mean: { type: Type.NUMBER },
                  sd: { type: Type.NUMBER },
                  status: { type: Type.STRING },
                  westgardRule: { type: Type.STRING }
                },
                required: ["testName", "machineName", "category", "level", "value", "mean", "sd", "status"]
              }
            }
          },
          required: ["qcResults"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      res.status(500).json({ error: "Không nhận được phản hồi từ mô hình AI." });
      return;
    }

    const parsedData = JSON.parse(textOutput.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("Lỗi xử lý phân tích báo cáo QC PDF:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi phân tích báo cáo QC PDF." });
  }
});


// Serve frontend assets in production or mount Vite dev server in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
