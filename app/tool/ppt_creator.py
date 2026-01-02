import os
from typing import List, Dict, Any
from app.tool.base import BaseTool, ToolResult

class PPTCreator(BaseTool):
    name: str = "ppt_creator"
    description: str = """
    Create a PowerPoint presentation (.pptx) from a list of slides.
    Each slide can have a title, content (bullet points), and an optional layout.
    """
    parameters: dict = {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "The output filename (e.g., 'presentation.pptx')."
            },
            "template": {
                "type": "string",
                "description": "Optional path to a .pptx file to use as a template/theme."
            },
            "slides": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "content": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of bullet points or paragraphs."
                        },
                        "images": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "path": {"type": "string"},
                                    "left": {"type": "number", "description": "In inches"},
                                    "top": {"type": "number", "description": "In inches"},
                                    "width": {"type": "number", "description": "In inches"}
                                },
                                "required": ["path"]
                            },
                            "description": "List of images to add."
                        },
                        "table": {
                            "type": "object",
                            "properties": {
                                "rows": {
                                    "type": "array",
                                    "items": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                },
                                "left": {"type": "number", "default": 1.0},
                                "top": {"type": "number", "default": 2.0},
                                "width": {"type": "number", "default": 8.0},
                                "height": {"type": "number", "default": 3.0}
                            },
                            "description": "Table data (list of rows)."
                        },
                        "layout": {
                            "type": "integer",
                            "description": "Slide layout index (0=Title, 1=Title+Content, etc.). Default is 1.",
                            "default": 1
                        }
                    },
                    "required": ["title", "content"]
                },
                "description": "List of slide objects."
            }
        },
        "required": ["filename", "slides"]
    }

    async def execute(self, filename: str, slides: List[Dict[str, Any]], template: str = None) -> ToolResult:
        try:
            from pptx import Presentation
            from pptx.util import Inches
        except ImportError:
            return ToolResult(error="python-pptx is not installed. Please install it first.")

        # --- ENFORCEMENT: Template Usage ---
        if template:
            if not os.path.exists(template):
                return ToolResult(error=f"❌ Template file not found: {template}. Please ensure the template exists before creating the presentation.")
            prs = Presentation(template)
            print(f"✅ Using template: {template}")
        else:
            prs = Presentation()
            print("ℹ️ No template provided, using default blank theme.")

        for slide_data in slides:
            layout_idx = slide_data.get("layout", 1)
            # Ensure layout index is valid (0-8 usually)
            if layout_idx >= len(prs.slide_layouts):
                layout_idx = 1
            
            slide_layout = prs.slide_layouts[layout_idx]
            slide = prs.slides.add_slide(slide_layout)

            # Set Title
            title = slide.shapes.title
            if title:
                title.text = slide_data.get("title", "")

            # Set Content (Body)
            content_text = slide_data.get("content", [])
            if content_text:
                body_shape = None
                
                # 1. Try standard body placeholder (idx 1)
                for shape in slide.placeholders:
                    if shape.placeholder_format.idx == 1:
                        body_shape = shape
                        break
                
                # 2. If not found, try ANY placeholder that is a body/object type
                if not body_shape:
                    for shape in slide.placeholders:
                        # 2=Body, 7=Object
                        if shape.placeholder_format.type in [2, 7]: 
                            body_shape = shape
                            break
                            
                # 3. Fallback: Try any shape that has a text_frame and isn't the title
                if not body_shape:
                    for shape in slide.shapes:
                        if shape.has_text_frame and shape != title:
                            body_shape = shape
                            break

                if body_shape and hasattr(body_shape, "text_frame"):
                    tf = body_shape.text_frame
                    tf.clear() # Clear default text
                    
                    for i, point in enumerate(content_text):
                        p = tf.add_paragraph() if i > 0 else tf.paragraphs[0]
                        p.text = point
                        p.level = 0 # Top level bullet

            # Add Images
            images = slide_data.get("images", [])
            for img in images:
                path = img.get("path")
                
                # --- ENFORCEMENT: Image Validation ---
                if not path:
                    continue
                    
                # Check for placeholder patterns
                if "path/to/" in path or "placeholder" in path.lower() or not os.path.exists(path):
                    print(f"⚠️ WARNING: Skipping invalid or missing image path: {path}")
                    # We could raise an error here to force the agent to retry, 
                    # but for now, let's log it loudly. 
                    # If we want to be strict:
                    # return ToolResult(error=f"❌ Invalid image path: {path}. Images MUST be downloaded locally before creating the presentation.")
                    continue

                if path and os.path.exists(path):
                    try:
                        left = Inches(img.get("left", 1))
                        top = Inches(img.get("top", 1))
                        width = Inches(img.get("width", 5))
                        slide.shapes.add_picture(path, left, top, width=width)
                    except Exception as e:
                        print(f"❌ Error adding image {path}: {e}")

            # Add Table
            table_data = slide_data.get("table")
            if table_data and "rows" in table_data:
                rows = table_data["rows"]
                if rows:
                    num_rows = len(rows)
                    num_cols = len(rows[0])
                    left = Inches(table_data.get("left", 1.0))
                    top = Inches(table_data.get("top", 2.0))
                    width = Inches(table_data.get("width", 8.0))
                    height = Inches(table_data.get("height", 3.0))
                    
                    graphic_frame = slide.shapes.add_table(num_rows, num_cols, left, top, width, height)
                    table = graphic_frame.table
                    
                    for r, row_data in enumerate(rows):
                        for c, cell_text in enumerate(row_data):
                            if c < num_cols:
                                table.cell(r, c).text = str(cell_text)

        # Save
        if not filename.endswith(".pptx"):
            filename += ".pptx"
            
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(filename)) or ".", exist_ok=True)
        
        prs.save(filename)
        
        abs_path = os.path.abspath(filename)
        return ToolResult(output=f"✅ Presentation saved to: {abs_path}")
