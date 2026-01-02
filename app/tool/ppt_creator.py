import os
import requests
from pptx import Presentation
from pptx.util import Inches, Pt
from app.tool.base import BaseTool, ToolResult

class PPTCreatorTool(BaseTool):
    name: str = "ppt_creator"
    description: str = """
    Creates a PowerPoint presentation with text and images.
    * Supports using a custom template (.pptx or .potx).
    * Can add multiple slides with titles, bullet points, and images.
    * AUTOMATICALLY downloads images if you provide a URL (http/https).
    * Saves downloaded images to 'input/' and the final PPT to 'output/'.
    """
    parameters: dict = {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": "The name of the output file (e.g., 'presentation.pptx'). Will be saved in 'output/' folder.",
            },
            "template": {
                "type": "string",
                "description": "Optional path to a template file (.pptx or .potx).",
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
                            "description": "List of bullet points",
                        },
                        "image_path": {
                            "type": "string",
                            "description": "Local path OR URL (http/https) to an image.",
                        },
                    },
                    "required": ["title", "content"],
                },
            },
        },
        "required": ["filename", "slides"],
    }

    def _download_image(self, url: str) -> str:
        """
        Downloads an image from a URL to the 'input/' folder.
        Returns the local file path.
        """
        try:
            # Create input directory if it doesn't exist
            input_dir = "input"
            if not os.path.exists(input_dir):
                os.makedirs(input_dir)

            # Extract filename from URL or generate a random one
            filename = url.split("/")[-1].split("?")[0]
            if not filename or "." not in filename:
                import uuid
                filename = f"image_{uuid.uuid4().hex[:8]}.jpg"
            
            local_path = os.path.join(input_dir, filename)

            # Download the file
            response = requests.get(url, stream=True, timeout=10)
            response.raise_for_status()
            
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"⬇️ Downloaded image: {url} -> {local_path}")
            return local_path
        except Exception as e:
            print(f"⚠️ Failed to download image {url}: {e}")
            return None

    async def execute(self, filename: str, slides: list, template: str = None, **kwargs) -> ToolResult:
        try:
            # Ensure output directory exists
            output_dir = "output"
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            # Prepend output directory to filename
            output_path = os.path.join(output_dir, filename)

            # Load template or create new
            if template:
                if not os.path.exists(template):
                    return ToolResult(error=f"Template file not found: {template}")
                prs = Presentation(template)
                print(f"✅ Using template: {template}")
            else:
                prs = Presentation()

            for slide_data in slides:
                # Choose layout (1 = Title and Content)
                slide_layout = prs.slide_layouts[1] if len(prs.slide_layouts) > 1 else prs.slide_layouts[0]
                slide = prs.slides.add_slide(slide_layout)

                # Set Title
                if slide.shapes.title:
                    slide.shapes.title.text = slide_data.get("title", "Untitled")

                # Set Content (Bullet Points)
                if slide.placeholders and len(slide.placeholders) > 1:
                    body_shape = slide.placeholders[1]
                    tf = body_shape.text_frame
                    tf.text = ""  # Clear default text
                    
                    for point in slide_data.get("content", []):
                        p = tf.add_paragraph()
                        p.text = point
                        p.level = 0

                # Add Image
                image_path = slide_data.get("image_path")
                if image_path:
                    # Check if it's a URL
                    if image_path.startswith("http://") or image_path.startswith("https://"):
                        image_path = self._download_image(image_path)

                    # Check if local file exists (after potential download)
                    if image_path and os.path.exists(image_path):
                        try:
                            # Add image to the right side (adjust positioning as needed)
                            left = Inches(5.5)
                            top = Inches(2)
                            height = Inches(3.5)
                            slide.shapes.add_picture(image_path, left, top, height=height)
                        except Exception as e:
                            print(f"⚠️ Error adding image {image_path}: {e}")
                    else:
                        print(f"⚠️ WARNING: Skipping invalid or missing image path: {image_path}")

            prs.save(output_path)
            return ToolResult(output=f"Presentation saved successfully to: {output_path}")

        except Exception as e:
            return ToolResult(error=f"Failed to create PPT: {e}")
