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

    async def execute(self, filename: str, slides: List[Dict[str, Any]]) -> ToolResult:
        try:
            from pptx import Presentation
        except ImportError:
            return ToolResult(error="python-pptx is not installed. Please install it first.")

        prs = Presentation()

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
                # Find the body placeholder (usually index 1)
                body_shape = None
                for shape in slide.placeholders:
                    if shape.placeholder_format.idx == 1:
                        body_shape = shape
                        break
                
                if body_shape and hasattr(body_shape, "text_frame"):
                    tf = body_shape.text_frame
                    tf.clear() # Clear default text
                    
                    for i, point in enumerate(content_text):
                        p = tf.add_paragraph() if i > 0 else tf.paragraphs[0]
                        p.text = point
                        p.level = 0 # Top level bullet

        # Save
        if not filename.endswith(".pptx"):
            filename += ".pptx"
            
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(filename)) or ".", exist_ok=True)
        
        prs.save(filename)
        
        abs_path = os.path.abspath(filename)
        return ToolResult(output=f"✅ Presentation saved to: {abs_path}")
